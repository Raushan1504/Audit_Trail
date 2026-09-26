const Event = require('../models/Event');
const { eventBus, EVENT_HOOKS } = require('./eventHandlers');

async function appendEvent(domainEvent) {
    const persistedEvent = new Event({
        aggregateId: domainEvent.aggregateId,
        eventType: domainEvent.eventType,
        payload: domainEvent.payload,
        timestamp: domainEvent.timestamp,
        version: domainEvent.version
    });
    const saved = await persistedEvent.save();

    // Trigger registered event hooks (e.g. projection worker)
    try {
        eventBus.emit(EVENT_HOOKS.EVENT_APPENDED, saved);
    } catch (err) {
        // Non-blocking: ensure hook handler errors do not disrupt persistence
        console.error('Error in eventAppended hook listener:', err);
    }

    return saved;
}

async function getEventsByAggregateId(aggregateId) {
    return await Event.find({ aggregateId }).sort({ version: 1 });
}

module.exports = {
    appendEvent,
    getEventsByAggregateId
};
