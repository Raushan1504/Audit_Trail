const EventEmitter = require('node:events');

const eventBus = new EventEmitter();

const EVENT_HOOKS = {
  EVENT_APPENDED: 'eventAppended'
};

module.exports = {
  eventBus,
  EVENT_HOOKS
};
