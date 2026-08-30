function createDomainEvent(aggregateId, eventType, payload, version) {
  if (!aggregateId) {
    throw new Error('aggregateId is required');
  }

  if (!eventType) {
    throw new Error('eventType is required');
  }

  if (!Number.isInteger(version) || version < 1) {
    throw new Error('version must be a positive integer');
  }

  return {
    aggregateId,
    eventType,
    payload: payload ?? {},
    timestamp: new Date(),
    version
  };
}

module.exports = {
  createDomainEvent
};