const { replayShipmentEvents } = require('./shipmentReducer');

function reconstructShipmentState(shipmentId, events) {
  if (!shipmentId) {
    throw new Error('shipmentId is required');
  }

  if (!Array.isArray(events)) {
    throw new Error('events must be an array');
  }

  return replayShipmentEvents(shipmentId, events);
}

function reconstructStateAsOf(shipmentId, events, targetVersion) {
  if (!shipmentId) {
    throw new Error('shipmentId is required');
  }

  if (!Array.isArray(events)) {
    throw new Error('events must be an array');
  }

  if (
    !Number.isInteger(targetVersion) ||
    targetVersion < 0
  ) {
    throw new Error(
      'targetVersion must be a non-negative integer'
    );
  }

  if (targetVersion === 0) {
    return replayShipmentEvents(shipmentId, []);
  }

  if (events.length === 0) {
    throw new Error(
      `targetVersion ${targetVersion} is not available`
    );
  }

  const historicalEvents = events.filter(
    (event) => event.version <= targetVersion
  );

  if (historicalEvents.length === 0) {
    throw new Error(
      `targetVersion ${targetVersion} is not available`
    );
  }

  const lastEvent =
    historicalEvents[historicalEvents.length - 1];

  if (lastEvent.version !== targetVersion) {
    throw new Error(
      `targetVersion ${targetVersion} is not available`
    );
  }

  return replayShipmentEvents(
    shipmentId,
    historicalEvents
  );
}

function reconstructStateAsOfTimestamp(
  shipmentId,
  events,
  targetTimestamp
) {
  if (!shipmentId) {
    throw new Error('shipmentId is required');
  }

  if (!Array.isArray(events)) {
    throw new Error('events must be an array');
  }

  const targetDate = new Date(targetTimestamp);

  if (
    typeof targetTimestamp !== 'string' ||
    Number.isNaN(targetDate.getTime())
  ) {
    throw new Error(
      'targetTimestamp must be a valid ISO timestamp'
    );
  }

  const historicalEvents = events.filter((event) => {
    if (!event.timestamp) {
      throw new Error(
        `event timestamp is required for version ${event.version}`
      );
    }

    const eventDate = new Date(event.timestamp);

    if (Number.isNaN(eventDate.getTime())) {
      throw new Error(
        `invalid event timestamp for version ${event.version}`
      );
    }

    return eventDate <= targetDate;
  });

  return replayShipmentEvents(
    shipmentId,
    historicalEvents
  );
}

module.exports = {
  reconstructShipmentState,
  reconstructStateAsOf,
  reconstructStateAsOfTimestamp
};