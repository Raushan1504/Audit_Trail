const { COMMAND_TYPES, validateCommand, validateStateTransition } = require('../domain/commandValidation');
const { createDomainEvent } = require('../events/createDomainEvent');
const { EVENT_TYPES } = require('../events/eventTypes');
const { createInitialShipmentState } = require('../domain/shipmentState');
const eventStore = require('../events/eventStore');
const { persistDomainEvent } = require('../events/persistDomainEvent');
const { validateOptimisticLock, ConcurrencyException } = require('../concurrency/optimisticConcurrency');

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
  const { shipmentId, origin, destination, cargo, expectedVersion, modifiedBy } = commandData;

  const command = {
    type: COMMAND_TYPES.CREATE_CONTAINER,
    shipmentId,
    origin,
    destination,
    cargo
  };

  validateCommand(command);

  if (expectedVersion !== undefined && expectedVersion !== null) {
    validateOptimisticLock({
      currentVersion: 0,
      expectedVersion,
      shipmentId,
      modifiedBy
    });
  }

  const events = await eventStore.getEventsByAggregateId(shipmentId);
  const existingEvent = events.length > 0 ? events[0] : null;

  if (existingEvent) {
    throw new ConcurrencyException(
      `Shipment with ID ${shipmentId} already exists`,
      {
        shipmentId,
        expectedVersion: expectedVersion ?? 0,
        currentVersion: existingEvent.version || 1,
        modifiedBy,
        resolutionHint: `Shipment '${shipmentId}' was already created. Query existing state or choose a new unique ID.`
      }
    );
  }

  validateStateTransition({ version: 0 }, COMMAND_TYPES.CREATE_CONTAINER);

  const eventPayload = { origin, destination, cargo };
  const domainEvent = createDomainEvent(shipmentId, EVENT_TYPES.CONTAINER_CREATED, eventPayload, 1);

  try {
    await persistDomainEvent(domainEvent, eventStore);
  } catch (err) {
    if (err.code === 11000) {
      throw new ConcurrencyException(
        `Optimistic concurrency collision: shipment '${shipmentId}' inception event version 1 already committed.`,
        {
          shipmentId,
          expectedVersion: 0,
          currentVersion: 1,
          modifiedBy,
          resolutionHint: `Shipment '${shipmentId}' was created concurrently by another transaction.`
        }
      );
    }
    throw err;
  }

  return {
    aggregateId: domainEvent.aggregateId,
    version: domainEvent.version,
    eventType: domainEvent.eventType
  };
};

/**
 * Handle the LoadShipment command.
 * @param {Object} commandData - { shipmentId, vessel, port, expectedVersion, modifiedBy }
 * @returns {Promise<Object>} The result of the command execution.
 */
const handleLoadShipment = async (commandData) => {
  const { shipmentId, vessel, port, expectedVersion, modifiedBy } = commandData;

  const command = {
    type: COMMAND_TYPES.LOAD_ON_SHIP,
    shipmentId,
    vessel,
    port
  };

  validateCommand(command);

  const events = await eventStore.getEventsByAggregateId(shipmentId);

  if (events.length === 0) {
    const err = new Error(`Shipment with ID ${shipmentId} not found`);
    err.status = 404;
    throw err;
  }

  const currentState = replayEvents(events);

  if (expectedVersion !== undefined && expectedVersion !== null) {
    validateOptimisticLock({
      currentVersion: currentState.version,
      expectedVersion,
      shipmentId,
      modifiedBy
    });
  }

  validateStateTransition(currentState, COMMAND_TYPES.LOAD_ON_SHIP);

  const eventPayload = { vessel, port };
  const nextVersion = currentState.version + 1;
  const domainEvent = createDomainEvent(shipmentId, EVENT_TYPES.LOADED_ON_SHIP, eventPayload, nextVersion);

  try {
    await persistDomainEvent(domainEvent, eventStore);
  } catch (err) {
    if (err.code === 11000) {
      throw new ConcurrencyException(
        `Optimistic concurrency collision: aggregate '${shipmentId}' version ${nextVersion} was already committed.`,
        {
          shipmentId,
          expectedVersion: currentState.version,
          currentVersion: nextVersion,
          modifiedBy,
          resolutionHint: `Reload shipment state at version ${nextVersion} and retry.`
        }
      );
    }
    throw err;
  }

  return {
    aggregateId: domainEvent.aggregateId,
    version: domainEvent.version,
    eventType: domainEvent.eventType
  };
};

/**
 * Handle the TemperatureSpike command.
 * Enriched with environmental and GPS telemetry metrics (Day 24).
 *
 * @param {Object} commandData - { shipmentId, temperature, threshold, sensorId, humidity, batteryVoltage, ambientTemp, coordinates, gps, expectedVersion, modifiedBy }
 * @returns {Promise<Object>} The result of the command execution.
 */
const handleTemperatureSpike = async (commandData) => {
  const {
    shipmentId,
    temperature,
    threshold,
    sensorId,
    humidity,
    batteryVoltage,
    ambientTemp,
    coordinates,
    gps,
    expectedVersion,
    modifiedBy
  } = commandData;

  const command = {
    type: COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
    shipmentId,
    temperature,
    threshold,
    sensorId
  };

  validateCommand(command);

  const events = await eventStore.getEventsByAggregateId(shipmentId);

  if (events.length === 0) {
    const err = new Error(`Shipment with ID ${shipmentId} not found`);
    err.status = 404;
    throw err;
  }

  const currentState = replayEvents(events);

  if (expectedVersion !== undefined && expectedVersion !== null) {
    validateOptimisticLock({
      currentVersion: currentState.version,
      expectedVersion,
      shipmentId,
      modifiedBy
    });
  }

  validateStateTransition(currentState, COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE);

  const eventPayload = {
    temperature: Number(temperature),
    threshold: Number(threshold),
    sensorId: sensorId || 'SENSOR-IOT-01',
    ...(humidity !== undefined && { humidity: Number(humidity) }),
    ...(batteryVoltage !== undefined && { batteryVoltage: Number(batteryVoltage) }),
    ...(ambientTemp !== undefined && { ambientTemp: Number(ambientTemp) }),
    ...(coordinates !== undefined && { coordinates }),
    ...(gps !== undefined && { gps })
  };

  const nextVersion = currentState.version + 1;
  const domainEvent = createDomainEvent(shipmentId, EVENT_TYPES.TEMPERATURE_SPIKE, eventPayload, nextVersion);

  try {
    await persistDomainEvent(domainEvent, eventStore);
  } catch (err) {
    if (err.code === 11000) {
      throw new ConcurrencyException(
        `Optimistic concurrency collision: aggregate '${shipmentId}' version ${nextVersion} was already committed.`,
        {
          shipmentId,
          expectedVersion: currentState.version,
          currentVersion: nextVersion,
          modifiedBy,
          resolutionHint: `Reload shipment state at version ${nextVersion} and retry.`
        }
      );
    }
    throw err;
  }

  return {
    aggregateId: domainEvent.aggregateId,
    version: domainEvent.version,
    eventType: domainEvent.eventType
  };
};

/**
 * Handle the ArriveAtPort command.
 * @param {Object} commandData - { shipmentId, port, expectedVersion, modifiedBy }
 * @returns {Promise<Object>} The result of the command execution.
 */
const handleArriveAtPort = async (commandData) => {
  const { shipmentId, port, expectedVersion, modifiedBy } = commandData;

  const command = {
    type: COMMAND_TYPES.ARRIVE_AT_PORT,
    shipmentId,
    port
  };

  validateCommand(command);

  const events = await eventStore.getEventsByAggregateId(shipmentId);

  if (events.length === 0) {
    const err = new Error(`Shipment with ID ${shipmentId} not found`);
    err.status = 404;
    throw err;
  }

  const currentState = replayEvents(events);

  if (expectedVersion !== undefined && expectedVersion !== null) {
    validateOptimisticLock({
      currentVersion: currentState.version,
      expectedVersion,
      shipmentId,
      modifiedBy
    });
  }

  validateStateTransition(currentState, COMMAND_TYPES.ARRIVE_AT_PORT);

  const eventPayload = { port };
  const nextVersion = currentState.version + 1;
  const domainEvent = createDomainEvent(shipmentId, EVENT_TYPES.ARRIVED_AT_PORT, eventPayload, nextVersion);

  try {
    await persistDomainEvent(domainEvent, eventStore);
  } catch (err) {
    if (err.code === 11000) {
      throw new ConcurrencyException(
        `Optimistic concurrency collision: aggregate '${shipmentId}' version ${nextVersion} was already committed.`,
        {
          shipmentId,
          expectedVersion: currentState.version,
          currentVersion: nextVersion,
          modifiedBy,
          resolutionHint: `Reload shipment state at version ${nextVersion} and retry.`
        }
      );
    }
    throw err;
  }

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
