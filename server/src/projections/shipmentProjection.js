const Event = require('../models/Event');
const ShipmentReadModel = require('../models/ShipmentReadModel');
const { EVENT_TYPES } = require('../events/eventTypes');

/**
 * Pure stateless projection updater.
 * Receives the current read model state (or null) and a canonical domain event,
 * and returns the updated read model state snapshot.
 *
 * @param {Object|null} current - Current read model snapshot
 * @param {Object} event - Domain event to project
 * @returns {Object} Updated read model state
 */
/**
 * Normalizes cargo data into a string format suitable for ShipmentReadModel.
 * Accepts strings or objects (e.g., { description: '...' }, { name: '...' }).
 */
function normalizeCargo(cargoVal) {
  if (cargoVal === null || cargoVal === undefined) return null;
  if (typeof cargoVal === 'string') return cargoVal.trim();
  if (typeof cargoVal === 'object') {
    return (cargoVal.description || cargoVal.name || cargoVal.type || JSON.stringify(cargoVal)).trim();
  }
  return String(cargoVal).trim();
}

function projectEvent(current, event) {
  if (!event || typeof event !== 'object') {
    throw new Error('event is required');
  }

  if (!event.eventType) {
    throw new Error('eventType is required');
  }

  if (!event.aggregateId) {
    throw new Error('aggregateId is required');
  }

  const base = {
    shipmentId: event.aggregateId,
    status: current?.status ?? 'CREATED',
    currentLocation: current?.currentLocation ?? current?.location ?? null,
    temperature: current?.temperature ?? null,
    lastAppliedVersion: current?.lastAppliedVersion ?? current?.version ?? 0,
    vessel: current?.vessel ?? null,
    cargo: normalizeCargo(current?.cargo),
    lastEventTimestamp: current?.lastEventTimestamp ?? null
  };

  const eventTimestamp = event.timestamp ? new Date(event.timestamp) : new Date();

  switch (event.eventType) {
    case EVENT_TYPES.CONTAINER_CREATED:
      return {
        ...base,
        status: 'CREATED',
        cargo: normalizeCargo(event.payload?.cargo ?? base.cargo),
        currentLocation:
          event.payload?.origin ??
          event.payload?.location ??
          event.payload?.port ??
          base.currentLocation,
        temperature: null,
        vessel: null,
        lastAppliedVersion: event.version ?? 1,
        lastEventTimestamp: eventTimestamp
      };

    case EVENT_TYPES.LOADED_ON_SHIP:
      return {
        ...base,
        status: 'LOADED',
        currentLocation:
          event.payload?.location ??
          event.payload?.port ??
          base.currentLocation,
        vessel: event.payload?.vessel ?? base.vessel,
        lastAppliedVersion: event.version ?? base.lastAppliedVersion + 1,
        lastEventTimestamp: eventTimestamp
      };

    case EVENT_TYPES.TEMPERATURE_SPIKE:
      return {
        ...base,
        status: 'TEMPERATURE_SPIKE',
        temperature:
          event.payload?.temperature ?? base.temperature,
        lastAppliedVersion: event.version ?? base.lastAppliedVersion + 1,
        lastEventTimestamp: eventTimestamp
      };

    case EVENT_TYPES.ARRIVED_AT_PORT:
      return {
        ...base,
        status: 'ARRIVED',
        currentLocation:
          event.payload?.location ??
          event.payload?.port ??
          base.currentLocation,
        lastAppliedVersion: event.version ?? base.lastAppliedVersion + 1,
        lastEventTimestamp: eventTimestamp
      };

    default:
      throw new Error(`Unsupported event type: ${event.eventType}`);
  }
}

/**
 * Persists an event projection to MongoDB ShipmentReadModel collection.
 * Enforces idempotency (ignores already-applied versions) and catches up
 * version gaps if out-of-order events occur.
 *
 * @param {Object} event - Domain event (plain object or Mongoose document)
 * @returns {Promise<{ applied: boolean, reason: string, shipmentId: string, version: number, readModel: Object }>}
 */
async function applyEventToReadModel(event) {
  if (!event || !event.aggregateId || !event.eventType) {
    throw new Error('Valid domain event with aggregateId and eventType is required');
  }

  const shipmentId = event.aggregateId;
  let readModel = await ShipmentReadModel.findOne({ shipmentId });

  // 1. Idempotency Check: if this version was already processed, skip
  if (readModel && readModel.lastAppliedVersion >= event.version) {
    return {
      applied: false,
      reason: 'ALREADY_APPLIED',
      shipmentId,
      version: readModel.lastAppliedVersion,
      readModel
    };
  }

  // 2. Version Gap Detection: if event.version > lastAppliedVersion + 1, catch up intermediate events
  const currentVersion = readModel ? readModel.lastAppliedVersion : 0;
  if (event.version > currentVersion + 1) {
    const missingEvents = await Event.find({
      aggregateId: shipmentId,
      version: { $gt: currentVersion, $lte: event.version }
    }).sort({ version: 1 });

    if (missingEvents && missingEvents.length > 0) {
      for (const ev of missingEvents) {
        readModel = await applySingleEvent(readModel, ev);
      }
      return {
        applied: true,
        reason: 'CAUGHT_UP_AND_APPLIED',
        shipmentId,
        version: readModel.lastAppliedVersion,
        readModel
      };
    }
  }

  // 3. Normal sequential application
  readModel = await applySingleEvent(readModel, event);

  return {
    applied: true,
    reason: 'APPLIED',
    shipmentId,
    version: readModel.lastAppliedVersion,
    readModel
  };
}

/**
 * Internal helper to project a single event into a Mongoose ShipmentReadModel document.
 */
async function applySingleEvent(readModel, event) {
  const currentSnapshot = readModel
    ? (typeof readModel.toObject === 'function' ? readModel.toObject() : readModel)
    : null;

  const nextSnapshot = projectEvent(currentSnapshot, event);

  if (!readModel) {
    // Check if created concurrently in DB
    const existing = await ShipmentReadModel.findOne({ shipmentId: event.aggregateId });
    if (existing) {
      if (existing.lastAppliedVersion >= event.version) {
        return existing;
      }
      Object.assign(existing, nextSnapshot);
      return await existing.save();
    }
    const created = new ShipmentReadModel(nextSnapshot);
    return await created.save();
  }

  Object.assign(readModel, nextSnapshot);
  return await readModel.save();
}

/**
 * Rebuilds the read model for a single shipment from its complete event log history.
 *
 * @param {string} shipmentId - Shipment aggregate ID
 * @returns {Promise<Object|null>}
 */
async function rebuildShipmentReadModel(shipmentId) {
  if (!shipmentId) {
    throw new Error('shipmentId is required');
  }

  const events = await Event.find({ aggregateId: shipmentId }).sort({ version: 1 });
  if (!events || events.length === 0) {
    return null;
  }

  let projected = null;
  for (const event of events) {
    projected = projectEvent(projected, event);
  }

  let readModel = await ShipmentReadModel.findOne({ shipmentId });
  if (!readModel) {
    readModel = new ShipmentReadModel(projected);
  } else {
    Object.assign(readModel, projected);
  }

  return await readModel.save();
}

/**
 * Rebuilds read models for all shipments stored in the Event Store.
 *
 * @returns {Promise<{ totalShipments: number, rebuiltCount: number, shipments: Array }>}
 */
async function rebuildAllReadModels() {
  const aggregateIds = await Event.distinct('aggregateId');
  const results = [];

  for (const shipmentId of aggregateIds) {
    const updated = await rebuildShipmentReadModel(shipmentId);
    if (updated) {
      results.push(updated);
    }
  }

  return {
    totalShipments: aggregateIds.length,
    rebuiltCount: results.length,
    shipments: results
  };
}

module.exports = {
  projectEvent,
  applyEventToReadModel,
  rebuildShipmentReadModel,
  rebuildAllReadModels
};
