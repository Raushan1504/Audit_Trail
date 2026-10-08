const EventEmitter = require('node:events');

class EventBus extends EventEmitter { }

const eventBus = new EventBus();

eventBus.setMaxListeners(50);

const EVENT_HOOKS = {
  EVENT_APPENDED: 'eventAppended'
};

module.exports = {
  eventBus,
  EVENT_HOOKS
};
