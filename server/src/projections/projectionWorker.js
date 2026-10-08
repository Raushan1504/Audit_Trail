const EventEmitter = require('node:events');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const ShipmentReadModel = require('../models/ShipmentReadModel');
const { applyEventToReadModel } = require('./shipmentProjection');
const { eventBus, EVENT_HOOKS } = require('../events/eventHandlers');

class ProjectionWorker extends EventEmitter {

  constructor(options = {}) {
    super();
    this.intervalMs = Number(options.intervalMs) || 2000;
    this.batchSize = Number(options.batchSize) || 100;
    this.autoHook = options.autoHook !== false;
    this.autoPoll = options.autoPoll !== false;

    this.isRunning = false;
    this.isPolling = false;
    this.timer = null;
    this.hookListener = null;

    this.stats = {
      processedEventsCount: 0,
      pollCyclesCount: 0,
      errorsCount: 0,
      lastPolledAt: null,
      lastProcessedAt: null,
      lastError: null
    };
  }

  start() {
    if (this.isRunning) {
      return this;
    }

    this.isRunning = true;

    if (this.autoHook) {
      this.attachHook();
    }

    if (this.autoPoll) {
      this.pollOnce().catch(() => {

      });

      this.timer = setInterval(() => {
        if (this.isRunning) {
          this.pollOnce().catch(() => {

          });
        }
      }, this.intervalMs);

      if (this.timer && typeof this.timer.unref === 'function') {
        this.timer.unref();
      }
    }

    this.emit('started', {
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
      autoHook: this.autoHook
    });

    return this;
  }

  stop() {
    this.isRunning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.detachHook();
    this.emit('stopped');

    return this;
  }

  attachHook(bus = eventBus) {
    if (this.hookListener) {
      return;
    }

    this.hookListener = async (event) => {
      try {
        const result = await this.processEvent(event, 'hook');
        this.emit('eventProjected', { event, result, source: 'hook', durationMs: result.durationMs });
      } catch (err) {
        this.stats.errorsCount++;
        this.stats.lastError = err.message;
        this.emit('error', err);
      }
    };

    bus.on(EVENT_HOOKS.EVENT_APPENDED, this.hookListener);
  }

  detachHook(bus = eventBus) {
    if (this.hookListener) {
      bus.removeListener(EVENT_HOOKS.EVENT_APPENDED, this.hookListener);
      this.hookListener = null;
    }
  }

  async processEvent(event, source = 'worker') {
    const startTime = performance.now();
    const result = await applyEventToReadModel(event);
    const durationMs = Number((performance.now() - startTime).toFixed(3));

    if (result.applied) {
      this.stats.processedEventsCount++;
      this.stats.lastProcessedAt = new Date();
      this.stats.lastDurationMs = durationMs;
    }

    return {
      ...result,
      durationMs
    };
  }

  async waitForVersion(shipmentId, expectedVersion, timeoutMs = 200) {
    if (!shipmentId) {
      throw new Error('shipmentId is required');
    }

    const immediate = await ShipmentReadModel.findOne({ shipmentId });
    if (immediate && (immediate.lastAppliedVersion ?? immediate.version) >= expectedVersion) {
      return immediate;
    }

    return new Promise((resolve, reject) => {
      let timer = null;

      const onProjected = async ({ event, result }) => {
        if (event && event.aggregateId === shipmentId) {
          const version = result?.version ?? (await ShipmentReadModel.findOne({ shipmentId }))?.lastAppliedVersion ?? 0;
          if (version >= expectedVersion) {
            cleanup();
            const doc = await ShipmentReadModel.findOne({ shipmentId });
            resolve(doc);
          }
        }
      };

      const onError = (err) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.removeListener('eventProjected', onProjected);
        this.removeListener('error', onError);
      };

      timer = setTimeout(async () => {
        try {
          const doc = await ShipmentReadModel.findOne({ shipmentId });
          if (doc && (doc.lastAppliedVersion ?? doc.version) >= expectedVersion) {
            cleanup();
            return resolve(doc);
          }
        } catch {

        }
        cleanup();
        const err = new Error(
          `Real-time sync SLA breached: shipment ${shipmentId} did not reach version ${expectedVersion} within ${timeoutMs}ms`
        );
        err.code = 'SYNC_TIMEOUT_SLA_BREACH';
        err.timeoutMs = timeoutMs;
        reject(err);
      }, timeoutMs);

      this.on('eventProjected', onProjected);
      this.once('error', onError);
    });
  }

  async pollOnce() {
    if (this.isPolling) {
      return { status: 'already_polling', processedCount: 0 };
    }

    this.isPolling = true;
    this.stats.pollCyclesCount++;
    this.stats.lastPolledAt = new Date();

    let processedCount = 0;

    try {

      const aggregateIds = await Event.distinct('aggregateId');

      for (const shipmentId of aggregateIds) {

        if (!this.isRunning && this.timer !== null) {
          break;
        }

        const readModel = await ShipmentReadModel.findOne({ shipmentId });
        const lastVersion = readModel ? readModel.lastAppliedVersion : 0;

        const unappliedEvents = await Event.find({
          aggregateId: shipmentId,
          version: { $gt: lastVersion }
        })
          .sort({ version: 1 })
          .limit(this.batchSize);

        for (const event of unappliedEvents) {
          const res = await this.processEvent(event, 'poll');
          if (res.applied) {
            processedCount++;
            this.emit('eventProjected', { event, result: res, source: 'poll', durationMs: res.durationMs });
          }
        }
      }

      this.emit('polled', { processedCount });
      return { status: 'success', processedCount };
    } catch (err) {
      this.stats.errorsCount++;
      this.stats.lastError = err.message;
      this.emit('error', err);
      throw err;
    } finally {
      this.isPolling = false;
    }
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      isPolling: this.isPolling,
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
      ...this.stats
    };
  }
}

const defaultWorker = new ProjectionWorker();
defaultWorker.on('error', (err) => {
  console.error('[ProjectionWorker] Background worker error:', err?.message || err);
});

function startProjectionWorker(options) {
  const worker = options ? new ProjectionWorker(options) : defaultWorker;
  if (options && typeof worker.on === 'function') {
    worker.on('error', (err) => {
      console.error('[ProjectionWorker] Worker error:', err?.message || err);
    });
  }
  worker.start();
  return worker;
}

function stopProjectionWorker() {
  defaultWorker.stop();
}

if (require.main === module) {
  require('dotenv').config();
  const { connectDB } = require('../config/db');

  async function runStandalone() {
    console.log('[ProjectionWorker] Starting background projection worker process...');
    await connectDB();

    const intervalMs = Number(process.env.WORKER_INTERVAL_MS) || 2000;
    const worker = new ProjectionWorker({ intervalMs });

    worker.on('started', (config) => {
      console.log(`[ProjectionWorker] Worker active (poll interval: ${config.intervalMs}ms)`);
    });

    worker.on('eventProjected', ({ event, source }) => {
      console.log(
        `[ProjectionWorker] [${source.toUpperCase()}] Projected ${event.eventType} (v${event.version}) for ${event.aggregateId}`
      );
    });

    worker.on('polled', ({ processedCount }) => {
      if (processedCount > 0) {
        console.log(`[ProjectionWorker] Catch-up poll synced ${processedCount} pending event(s)`);
      }
    });

    worker.on('error', (err) => {
      console.error('[ProjectionWorker] Worker error:', err.message);
    });

    worker.start();

    const shutdown = () => {
      console.log('\n[ProjectionWorker] Shutting down projection worker...');
      worker.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  runStandalone().catch((err) => {
    console.error('[ProjectionWorker] Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = {
  ProjectionWorker,
  defaultWorker,
  startProjectionWorker,
  stopProjectionWorker
};
