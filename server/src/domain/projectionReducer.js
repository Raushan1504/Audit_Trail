const { EVENT_TYPES } = require('../events/eventTypes');

function applyProjectionEvent(state, event) {
  if (!state || typeof state !== 'object') {
    throw new Error('projection state is required');
  }

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
        location:
          event.payload?.location ??
          event.payload?.port ??
          state.location,
        vessel:
          event.payload?.vessel ??
          state.vessel
      };

    case EVENT_TYPES.TEMPERATURE_SPIKE:
      return {
        ...nextState,
        status: 'TEMPERATURE_SPIKE',
        temperature:
          event.payload?.temperature ??
          state.temperature
      };

    case EVENT_TYPES.ARRIVED_AT_PORT:
      return {
        ...nextState,
        status: 'ARRIVED',
        location:
          event.payload?.location ??
          event.payload?.port ??
          state.location
      };

    default:
      throw new Error(
        `Unsupported event type: ${event.eventType}`
      );
  }
}

module.exports = {
  applyProjectionEvent
};
