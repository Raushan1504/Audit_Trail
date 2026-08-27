const Event = require('../models/Event');

async function appendEvent(domainEvent) {
    const persistedEvent = new Event({
        aggregateId: domainEvent.aggregateId,
        eventType: domainEvent.eventType,
        payload: domainEvent.payload,
        timestamp: domainEvent.timestamp,
        version: domainEvent.version
    });
    return await persistedEvent.save();
}

async function getEventsByAggregateId(aggregateId) {
    return await Event.find({ aggregateId }).sort({ version: 1 });
}

module.exports = {
    appendEvent,
    getEventsByAggregateId
};
