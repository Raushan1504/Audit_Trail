const { COMMAND_TYPES, validateCommand, validateStateTransition } = require('../domain/commandValidation');
const { createDomainEvent } = require('../events/createDomainEvent');
const { EVENT_TYPES } = require('../events/eventTypes');
const Event = require('../models/Event');
const { createInitialShipmentState } = require('../domain/shipmentState');

/**
 * Replays domain events sequentially to reconstruct the current shipment state.
 * @param {Array} events - The chronological list of events for the shipment.
 * @returns {Object} The reconstructed shipment state.
 */
function replayEvents(events) {
  if (!events || events.length === 0) {
    return { status: null, version: 0 };
  }

  let state = null;
  for (const event of events) {
    if (event.eventType === EVENT_TYPES.CONTAINER_CREATED) {
      state = createInitialShipmentState(event.aggregateId);
      state.version = event.version;
    } else {
      if (!state) {
        throw new Error('State reconstruction failed: first event must be CONTAINER_CREATED');
      }
      state.version = event.version;
      if (event.eventType === EVENT_TYPES.LOADED_ON_SHIP) {
        state.status = 'LOADED';
        state.location = event.payload?.port || null;
        state.vessel = event.payload?.vessel || null;
      } else if (event.eventType === EVENT_TYPES.TEMPERATURE_SPIKE) {
        state.status = 'TEMPERATURE_SPIKE';
        state.temperature = event.payload?.temperature || null;
      } else if (event.eventType === EVENT_TYPES.ARRIVED_AT_PORT) {
        state.status = 'ARRIVED';
        state.location = event.payload?.port || null;
      }
    }
  }
  return state;
}

/**
 * Handle the CreateShipment command.
 * @param {Object} commandData - { shipmentId, origin, destination, cargo }
 * @returns {Promise<Object>} The result of the command execution.
 */
const handleCreateShipment = async (commandData) => {
  const { shipmentId, origin, destination, cargo } = commandData;

  const command = {
    type: COMMAND_TYPES.CREATE_CONTAINER,
    shipmentId,
    origin,
    destination,
    cargo
  };

  validateCommand(command);
  const existingEvent = await Event.findOne({ aggregateId: shipmentId });
  if (existingEvent) {
    const err = new Error(`Shipment with ID ${shipmentId} already exists`);
    err.status = 409;
    throw err;
  }

  validateStateTransition({ version: 0 }, COMMAND_TYPES.CREATE_CONTAINER);

  const eventPayload = { origin, destination, cargo };
  const domainEvent = createDomainEvent(shipmentId, EVENT_TYPES.CONTAINER_CREATED, eventPayload, 1);

  const persistedEvent = new Event({
    aggregateId: domainEvent.aggregateId,
    eventType: domainEvent.eventType,
    payload: domainEvent.payload,
    timestamp: domainEvent.timestamp,
    version: domainEvent.version
  });

  await persistedEvent.save();

  return {
    aggregateId: domainEvent.aggregateId,
    version: domainEvent.version,
    eventType: domainEvent.eventType
  };
};

/**
 * Handle the LoadShipment command.
 * @param {Object} commandData - { shipmentId, vessel, port }
 * @returns {Promise<Object>} The result of the command execution.
 */
const handleLoadShipment = async (commandData) => {
  const { shipmentId, vessel, port } = commandData;

  const command = {
    type: COMMAND_TYPES.LOAD_ON_SHIP,
    shipmentId,
    vessel,
    port
  };

  validateCommand(command);

  const events = await Event.find({ aggregateId: shipmentId }).sort({ version: 1 });
  if (events.length === 0) {
    const err = new Error(`Shipment with ID ${shipmentId} not found`);
    err.status = 404;
    throw err;
  }

  const currentState = replayEvents(events);
  validateStateTransition(currentState, COMMAND_TYPES.LOAD_ON_SHIP);

  const eventPayload = { vessel, port };
  const nextVersion = currentState.version + 1;
  const domainEvent = createDomainEvent(shipmentId, EVENT_TYPES.LOADED_ON_SHIP, eventPayload, nextVersion);

  const persistedEvent = new Event({
    aggregateId: domainEvent.aggregateId,
    eventType: domainEvent.eventType,
    payload: domainEvent.payload,
    timestamp: domainEvent.timestamp,
    version: domainEvent.version
  });

  await persistedEvent.save();

  return {
    aggregateId: domainEvent.aggregateId,
    version: domainEvent.version,
    eventType: domainEvent.eventType
  };
};

/**
 * Handle the TemperatureSpike command.
 * @param {Object} commandData - { shipmentId, temperature, threshold, sensorId }
 * @returns {Promise<Object>} The result of the command execution.
 */
const handleTemperatureSpike = async (commandData) => {
  const { shipmentId, temperature, threshold, sensorId } = commandData;

  const command = {
    type: COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
    shipmentId,
    temperature,
    threshold,
    sensorId
  };

  validateCommand(command);

  const events = await Event.find({ aggregateId: shipmentId }).sort({ version: 1 });
  if (events.length === 0) {
    const err = new Error(`Shipment with ID ${shipmentId} not found`);
    err.status = 404;
    throw err;
  }

  const currentState = replayEvents(events);
  validateStateTransition(currentState, COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE);

  const eventPayload = { temperature, threshold, sensorId };
  const nextVersion = currentState.version + 1;
  const domainEvent = createDomainEvent(shipmentId, EVENT_TYPES.TEMPERATURE_SPIKE, eventPayload, nextVersion);

  const persistedEvent = new Event({
    aggregateId: domainEvent.aggregateId,
    eventType: domainEvent.eventType,
    payload: domainEvent.payload,
    timestamp: domainEvent.timestamp,
    version: domainEvent.version
  });

  await persistedEvent.save();

  return {
    aggregateId: domainEvent.aggregateId,
    version: domainEvent.version,
    eventType: domainEvent.eventType
  };
};

/**
 * Handle the ArriveAtPort command.
 * @param {Object} commandData - { shipmentId, port }
 * @returns {Promise<Object>} The result of the command execution.
 */
const handleArriveAtPort = async (commandData) => {
  const { shipmentId, port } = commandData;

  const command = {
    type: COMMAND_TYPES.ARRIVE_AT_PORT,
    shipmentId,
    port
  };

  validateCommand(command);

  const events = await Event.find({ aggregateId: shipmentId }).sort({ version: 1 });
  if (events.length === 0) {
    const err = new Error(`Shipment with ID ${shipmentId} not found`);
    err.status = 404;
    throw err;
  }

  const currentState = replayEvents(events);
  validateStateTransition(currentState, COMMAND_TYPES.ARRIVE_AT_PORT);

  const eventPayload = { port };
  const nextVersion = currentState.version + 1;
  const domainEvent = createDomainEvent(shipmentId, EVENT_TYPES.ARRIVED_AT_PORT, eventPayload, nextVersion);

  const persistedEvent = new Event({
    aggregateId: domainEvent.aggregateId,
    eventType: domainEvent.eventType,
    payload: domainEvent.payload,
    timestamp: domainEvent.timestamp,
    version: domainEvent.version
  });

  await persistedEvent.save();

  return {
    aggregateId: domainEvent.aggregateId,
    version: domainEvent.version,
    eventType: domainEvent.eventType
  };
};

module.exports = {
  handleCreateShipment,
  handleLoadShipment,
  handleTemperatureSpike,
  handleArriveAtPort
};
