const EventEmitter = require('node:events');

/**
 * Global Event Bus for internal domain event notifications.
 * Decouples the append-only Event Store persistence from asynchronous
 * read-model projection consumers and worker hooks.
 */
class EventBus extends EventEmitter {}

const eventBus = new EventBus();

// Increase max listeners to prevent warnings when multiple workers or test fixtures attach
eventBus.setMaxListeners(50);

const EVENT_HOOKS = {
  EVENT_APPENDED: 'eventAppended'
};

module.exports = {
  eventBus,
  EVENT_HOOKS
};
