const { EVENT_TYPES } = require('../events/eventTypes');
const { createInitialShipmentState } = require('./shipmentState');

function applyEvent(state, event) {
  if (!event || typeof event !== 'object') {
    throw new Error('event is required');
  }

  if (!event.eventType) {
    throw new Error('eventType is required');
  }

  const nextState = {
    ...state,
    version: event.version ?? state.version
  };

  switch (event.eventType) {
    case EVENT_TYPES.CONTAINER_CREATED:
      return {
        ...nextState,
        status: 'CREATED'
      };

    case EVENT_TYPES.LOADED_ON_SHIP:
      return {
        ...nextState,
        status: 'LOADED',
        location: event.payload?.location ?? event.payload?.port ?? state.location,
        vessel: event.payload?.vessel ?? state.vessel ?? null
      };

    case EVENT_TYPES.TEMPERATURE_SPIKE:
      return {
        ...nextState,
        status: 'TEMPERATURE_SPIKE',
        temperature:
          event.payload?.temperature ?? state.temperature
      };

    case EVENT_TYPES.ARRIVED_AT_PORT:
      return {
        ...nextState,
        status: 'ARRIVED',
        location: event.payload?.location ?? event.payload?.port ?? state.location
      };

    default:
      throw new Error(`Unsupported event type: ${event.eventType}`);
  }
}

function replayShipmentEvents(shipmentId, events) {
  if (!shipmentId) {
    throw new Error('shipmentId is required');
  }

  if (!Array.isArray(events)) {
    throw new Error('events must be an array');
  }

  let state = createInitialShipmentState(shipmentId);
  let expectedVersion = 1;

  for (const event of events) {
    if (!event || typeof event !== 'object') {
      throw new Error('event is required');
    }

    if (event.aggregateId && event.aggregateId !== shipmentId) {
      throw new Error(
        `Event aggregateId ${event.aggregateId} does not match shipmentId ${shipmentId}`
      );
    }

    if (event.version !== expectedVersion) {
      throw new Error(
        `invalid event version: expected ${expectedVersion}, got ${event.version}`
      );
    }

    expectedVersion++;

    state = applyEvent(state, event);
  }

  return state;
}

module.exports = {
  applyEvent,
  replayShipmentEvents
};