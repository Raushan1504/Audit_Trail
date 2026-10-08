const Event = require('../models/Event');
const ShipmentReadModel = require('../models/ShipmentReadModel');
const { EVENT_TYPES } = require('../events/eventTypes');

function normalizeCargo(cargoVal) {
  if (cargoVal === null || cargoVal === undefined) return null;

  if (typeof cargoVal === 'string') {
    return cargoVal.trim();
  }

  if (typeof cargoVal === 'object') {
    return (
      cargoVal.description ||
      cargoVal.name ||
      cargoVal.type ||
      JSON.stringify(cargoVal)
    ).trim();
  }

  return String(cargoVal).trim();
}

function projectEvent(priorState, event) {
  if (!event || typeof event !== 'object') {
    throw new Error('event is required');
  }

  if (!event.eventType) {
    throw new Error('eventType is required');
  }

  if (!event.aggregateId) {
    throw new Error('aggregateId is required');
  }

  const timestamp = event.timestamp
    ? new Date(event.timestamp)
    : new Date();

  const base = {
    shipmentId: event.aggregateId,
    status: priorState?.status ?? 'CREATED',
    currentLocation:
      priorState?.currentLocation ??
      priorState?.location ??
      null,

    temperature: priorState?.temperature ?? null,

    humidity: priorState?.humidity ?? null,
    batteryVoltage: priorState?.batteryVoltage ?? null,
    ambientTemp: priorState?.ambientTemp ?? null,

    coordinates: priorState?.coordinates ?? null,

    lastAppliedVersion:
      priorState?.lastAppliedVersion ??
      priorState?.version ??
      0,

    vessel: priorState?.vessel ?? null,
    cargo: normalizeCargo(priorState?.cargo),
    lastEventTimestamp: priorState?.lastEventTimestamp ?? null
  };

  switch (event.eventType) {
    case EVENT_TYPES.CONTAINER_CREATED:
      return {
        ...base,
        status: 'CREATED',
        cargo: normalizeCargo(
          event.payload?.cargo ?? base.cargo
        ),
        currentLocation:
          event.payload?.origin ??
          event.payload?.location ??
          event.payload?.port ??
          base.currentLocation,

        temperature: null,

        vessel: null,

        lastAppliedVersion:
          event.version ?? 1,

        lastEventTimestamp: timestamp
      };

    case EVENT_TYPES.LOADED_ON_SHIP:
      return {
        ...base,
        status: 'LOADED',
        currentLocation:
          event.payload?.port ??
          event.payload?.location ??
          base.currentLocation,

        vessel:
          event.payload?.vessel ??
          base.vessel,

        lastAppliedVersion:
          event.version ??
          base.lastAppliedVersion + 1,

        lastEventTimestamp: timestamp
      };

    case EVENT_TYPES.TEMPERATURE_SPIKE:
      return {
        ...base,
        status: 'TEMPERATURE_SPIKE',

        temperature:
          event.payload?.temperature ??
          base.temperature,

        humidity:
          event.payload?.humidity ??
          base.humidity,

        batteryVoltage:
          event.payload?.batteryVoltage ??
          base.batteryVoltage,

        ambientTemp:
          event.payload?.ambientTemp ??
          base.ambientTemp,

        coordinates:
          event.payload?.coordinates ??
          event.payload?.gps ??
          base.coordinates,

        lastAppliedVersion:
          event.version ??
          base.lastAppliedVersion + 1,

        lastEventTimestamp: timestamp
      };

    case EVENT_TYPES.ARRIVED_AT_PORT:
      return {
        ...base,
        status: 'ARRIVED',

        currentLocation:
          event.payload?.port ??
          event.payload?.location ??
          base.currentLocation,

        lastAppliedVersion:
          event.version ??
          base.lastAppliedVersion + 1,

        lastEventTimestamp: timestamp
      };

    default:
      throw new Error(
        `Unsupported event type: ${event.eventType}`
      );
  }
}

async function applyEventToReadModel(event) {
  if (!event || !event.aggregateId || !event.eventType) {
    throw new Error(
      'Valid domain event with aggregateId and eventType is required'
    );
  }

  const shipmentId = event.aggregateId;

  let readModel = await ShipmentReadModel.findOne({
    shipmentId
  });

  if (
    readModel &&
    readModel.lastAppliedVersion >= event.version
  ) {
    return {
      applied: false,
      reason: 'ALREADY_APPLIED',
      version: readModel.lastAppliedVersion,
      shipmentId,
      readModel
    };
  }

  const currentVersion = readModel
    ? readModel.lastAppliedVersion
    : 0;

  if (event.version > currentVersion + 1) {
    const missingEvents = await Event.find({
      aggregateId: shipmentId,
      version: {
        $gt: currentVersion,
        $lte: event.version
      }
    }).sort({ version: 1 });

    if (missingEvents && missingEvents.length > 0) {
      for (const ev of missingEvents) {
        readModel = await applySingleEvent(
          readModel,
          ev
        );
      }

      return {
        applied: true,
        reason: 'CAUGHT_UP_AND_APPLIED',
        version: readModel.lastAppliedVersion,
        shipmentId,
        readModel
      };
    }
  }

  readModel = await applySingleEvent(
    readModel,
    event
  );

  return {
    applied: true,
    reason: 'APPLIED',
    version: readModel.lastAppliedVersion,
    shipmentId,
    readModel
  };
}

async function applySingleEvent(readModel, event) {
  const currentSnapshot = readModel
    ? (
        typeof readModel.toObject === 'function'
          ? readModel.toObject()
          : readModel
      )
    : null;

  const nextSnapshot = projectEvent(
    currentSnapshot,
    event
  );

  if (!readModel) {
    const existing = await ShipmentReadModel.findOne({
      shipmentId: event.aggregateId
    });

    if (existing) {
      if (
        existing.lastAppliedVersion >= event.version
      ) {
        return existing;
      }

      Object.assign(
        existing,
        nextSnapshot
      );

      return await existing.save();
    }

    const created = new ShipmentReadModel(
      nextSnapshot
    );

    return await created.save();
  }

  Object.assign(
    readModel,
    nextSnapshot
  );

  return await readModel.save();
}

async function rebuildShipmentReadModel(shipmentId) {
  if (!shipmentId) {
    throw new Error('shipmentId is required');
  }

  const eventsQuery = Event.find({
    aggregateId: shipmentId
  });

  const events =
    typeof eventsQuery.sort === 'function'
      ? await eventsQuery.sort({ version: 1 })
      : await eventsQuery;

  if (!events || events.length === 0) {
    return null;
  }

  let projected = null;

  for (const event of events) {
    projected = projectEvent(
      projected,
      event
    );
  }

  let readModel = await ShipmentReadModel.findOne({
    shipmentId
  });

  if (!readModel) {
    readModel = new ShipmentReadModel(
      projected
    );
  } else {
    Object.assign(
      readModel,
      projected
    );
  }

  return await readModel.save();
}

async function rebuildAllReadModels(options = {}) {
  if (options.clean && !options.dryRun) {
    await ShipmentReadModel.deleteMany({});
  }

  let aggregateIds;

  if (options.shipmentId) {
    aggregateIds = [
      options.shipmentId.trim()
    ];
  } else {
    aggregateIds =
      await Event.distinct('aggregateId');
  }

  const results = [];
  let totalEventsReplayed = 0;

  for (const shipmentId of aggregateIds) {
    const eventsQuery = Event.find({
      aggregateId: shipmentId
    });

    const events =
      typeof eventsQuery.sort === 'function'
        ? await eventsQuery.sort({
            version: 1
          })
        : await eventsQuery;

    if (!events || events.length === 0) {
      continue;
    }

    totalEventsReplayed += events.length;

    let projected = null;

    for (const event of events) {
      projected = projectEvent(
        projected,
        event
      );
    }

    if (options.dryRun) {
      results.push(projected);
    } else {
      let readModel =
        await ShipmentReadModel.findOne({
          shipmentId
        });

      if (!readModel) {
        readModel =
          new ShipmentReadModel(projected);
      } else {
        Object.assign(
          readModel,
          projected
        );
      }

      const saved =
        await readModel.save();

      results.push(saved);
    }
  }

  return {
    totalShipments: aggregateIds.length,
    rebuiltCount: results.length,
    totalEventsReplayed,
    shipments: results
  };
}

module.exports = {
  projectEvent,
  applyEventToReadModel,
  rebuildShipmentReadModel,
  rebuildAllReadModels
};