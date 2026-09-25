const EventEmitter = require('node:events');
const { eventBus, EVENT_HOOKS } = require('../events/eventHandlers');
const Event = require('../models/Event');
const ShipmentReadModel = require('../models/ShipmentReadModel');
const { applyEventToReadModel } = require('./shipmentProjection');

/**
 * Background Projection Worker
 *
 * Consumes domain events from the Event Store either via real-time eventBus hooks
 * or scheduled polling cycles and updates the read-optimized ShipmentReadModel.
 */
class ProjectionWorker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.intervalMs = options.intervalMs ?? 2000;
    this.batchSize = options.batchSize ?? 100;
    this.isRunning = false;
    this.timer = null;
    this.processedEventsCount = 0;
    this.errorsCount = 0;
    this.hookListener = null;

    if (options.autoHook === true) {
      this.attachHook();
    }
    if (options.autoPoll === true) {
      this.start();
    }
  }

  /**
   * Retrieves operational telemetry statistics for the projection worker.
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
      processedEventsCount: this.processedEventsCount,
      errorsCount: this.errorsCount
    };
  }

  /**
   * Starts the periodic polling loop.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(async () => {
      try {
        await this.pollOnce();
      } catch (err) {
        // error already captured and emitted by pollOnce
      }
    }, this.intervalMs);
  }

  /**
   * Stops the periodic polling loop.
   */
  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Attaches real-time eventBus hook to project events immediately upon append.
   */
  attachHook() {
    if (this.hookListener) return;

    this.hookListener = async (domainEvent) => {
      try {
        const result = await applyEventToReadModel(domainEvent);
        this.processedEventsCount++;
        this.emit('eventProjected', {
          source: 'hook',
          event: domainEvent,
          result
        });
      } catch (err) {
        this.errorsCount++;
        this.emit('error', err);
      }
    };

    eventBus.on(EVENT_HOOKS.EVENT_APPENDED, this.hookListener);
  }

  /**
   * Detaches the real-time eventBus hook.
   */
  detachHook() {
    if (this.hookListener) {
      eventBus.removeListener(EVENT_HOOKS.EVENT_APPENDED, this.hookListener);
      this.hookListener = null;
    }
  }

  /**
   * Executes a single polling cycle across all active aggregates.
   * Catches up any unapplied events into the read model.
   *
   * @returns {Promise<Object>} { status: 'success', processedCount: number }
   */
  async pollOnce() {
    let processedCount = 0;
    try {
      const aggregateIds = await Event.distinct('aggregateId');

      for (const aggregateId of aggregateIds) {
        const doc = await ShipmentReadModel.findOne({ shipmentId: aggregateId });
        const lastVersion = doc?.lastAppliedVersion || 0;

        const query = { aggregateId };
        if (lastVersion > 0) {
          query.version = { $gt: lastVersion };
        }

        const eventsQuery = Event.find(query);
        let events = [];
        if (eventsQuery && typeof eventsQuery.sort === 'function') {
          const sorted = eventsQuery.sort({ version: 1 });
          if (sorted && typeof sorted.limit === 'function') {
            events = await sorted.limit(this.batchSize);
          } else {
            events = await sorted;
          }
        } else {
          events = await eventsQuery;
        }

        if (Array.isArray(events)) {
          for (const event of events) {
            const result = await applyEventToReadModel(event);
            if (result.applied) {
              processedCount++;
              this.processedEventsCount++;
              this.emit('eventProjected', {
                source: 'poll',
                event,
                result
              });
            }
          }
        }
      }

      return { status: 'success', processedCount };
    } catch (err) {
      this.errorsCount++;
      this.emit('error', err);
      throw err;
    }
  }
}

module.exports = {
  ProjectionWorker
};
