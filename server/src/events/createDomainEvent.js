function createDomainEvent(aggregateId, eventType, payload, version) {
  if (!aggregateId) {
    throw new Error('aggregateId is required');
  }

  if (!eventType) {
    throw new Error('eventType is required');
  }

  return {
    aggregateId,
    eventType,
    payload,
    timestamp: new Date(),
    version
  };
}

module.exports = {
  createDomainEvent
};