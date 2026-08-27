function persistDomainEvent(event, eventStore) {
  if (!event) {
    throw new Error('event is required');
  }

  if (!eventStore || typeof eventStore.appendEvent !== 'function') {
    throw new Error('eventStore with appendEvent is required');
  }

  return eventStore.appendEvent(event);
}

module.exports = {
  persistDomainEvent
};