const EventEmitter = require('node:events');
const Event = require('../models/Event');
const ShipmentReadModel = require('../models/ShipmentReadModel');
const { applyEventToReadModel } = require('./shipmentProjection');
const { eventBus, EVENT_HOOKS } = require('../events/eventHandlers');

/**
 * Background Node.js Projection Worker.
 *
 * Implements a dual-mode event consumption architecture for CQRS:
 *  1. Event Hook (Push): Registers an immediate in-memory hook on eventStore appends
 *     for sub-millisecond projection latency.
 *  2. Worker Loop (Pull): Runs a periodic background polling loop to detect unapplied
 *     or out-of-sync events in MongoDB, ensuring crash resiliency and eventual consistency.
 */
class ProjectionWorker extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {number} [options.intervalMs=2000] - Polling interval in milliseconds
   * @param {number} [options.batchSize=100] - Max events to project per shipment per poll cycle
   * @param {boolean} [options.autoHook=true] - Whether to attach eventBus hook on start
   */
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

  /**
   * Starts the background projection worker loop and attaches event hooks.
   */
  start() {
    if (this.isRunning) {
      return this;
    }

    this.isRunning = true;

    // 1. Attach real-time event hook
    if (this.autoHook) {
      this.attachHook();
    }

    // 2. Perform initial catch-up poll immediately if autoPoll enabled
    if (this.autoPoll) {
      this.pollOnce().catch((err) => {
        this.emit('error', err);
      });

      // 3. Start recurring polling interval for background catch-up
      this.timer = setInterval(() => {
        if (this.isRunning) {
          this.pollOnce().catch((err) => {
            this.emit('error', err);
          });
        }
      }, this.intervalMs);

      // Prevent worker timer from blocking Node.js process exit if unref is supported
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

  /**
   * Gracefully stops the worker loop and detaches all event hooks.
   */
  stop() {
    if (!this.isRunning) {
      return this;
    }

    this.isRunning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.detachHook();
    this.emit('stopped');

    return this;
  }

  /**
   * Registers listener on eventBus for instantaneous push-based projection updates.
   *
   * @param {EventEmitter} [bus=eventBus]
   */
  attachHook(bus = eventBus) {
    if (this.hookListener) {
      return;
    }

    this.hookListener = async (event) => {
      try {
        const result = await this.processEvent(event, 'hook');
        this.emit('eventProjected', { event, result, source: 'hook' });
      } catch (err) {
        this.stats.errorsCount++;
        this.stats.lastError = err.message;
        this.emit('error', err);
      }
    };

    bus.on(EVENT_HOOKS.EVENT_APPENDED, this.hookListener);
  }

  /**
   * Removes listener from eventBus.
   *
   * @param {EventEmitter} [bus=eventBus]
   */
  detachHook(bus = eventBus) {
    if (this.hookListener) {
      bus.removeListener(EVENT_HOOKS.EVENT_APPENDED, this.hookListener);
      this.hookListener = null;
    }
  }

  /**
   * Projects a single domain event into the ShipmentReadModel.
   *
   * @param {Object} event - Domain event document
   * @param {string} [source='worker'] - Origin of event ('hook' | 'poll' | 'worker')
   * @returns {Promise<Object>}
   */
  async processEvent(event, source = 'worker') {
    const result = await applyEventToReadModel(event);

    if (result.applied) {
      this.stats.processedEventsCount++;
      this.stats.lastProcessedAt = new Date();
    }

    return result;
  }

  /**
   * Executes a single polling iteration across all shipments in the Event Store.
   * Identifies any events whose version exceeds the ShipmentReadModel's lastAppliedVersion
   * and projects them sequentially.
   *
   * @returns {Promise<{ status: string, processedCount: number }>}
   */
  async pollOnce() {
    if (this.isPolling) {
      return { status: 'already_polling', processedCount: 0 };
    }

    this.isPolling = true;
    this.stats.pollCyclesCount++;
    this.stats.lastPolledAt = new Date();

    let processedCount = 0;

    try {
      // Find all unique aggregate IDs in the Event Store
      const aggregateIds = await Event.distinct('aggregateId');

      for (const shipmentId of aggregateIds) {
        // If worker was stopped mid-poll, break early
        if (!this.isRunning && this.timer !== null) {
          break;
        }

        const readModel = await ShipmentReadModel.findOne({ shipmentId });
        const lastVersion = readModel ? readModel.lastAppliedVersion : 0;

        // Query pending unapplied events strictly higher than read model version
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
            this.emit('eventProjected', { event, result: res, source: 'poll' });
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

  /**
   * Returns runtime statistics and health metrics for the projection worker.
   *
   * @returns {Object}
   */
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

// Default singleton worker instance for app-wide reuse
const defaultWorker = new ProjectionWorker();
defaultWorker.on('error', (err) => {
  console.error('[ProjectionWorker] Background worker error:', err?.message || err);
});

/**
 * Convenience helper to initialize and start the projection worker.
 *
 * @param {Object} [options]
 * @returns {ProjectionWorker}
 */
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

/**
 * Convenience helper to stop the default projection worker.
 */
function stopProjectionWorker() {
  defaultWorker.stop();
}

// ── Standalone CLI Entry Point ─────────────────────────────────────────
// Enables running the projection worker as a dedicated independent process
// e.g. via `node src/projections/projectionWorker.js` or Render background worker
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
