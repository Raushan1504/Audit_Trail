const { EVENT_TYPES } = require('../events/eventTypes');
const Event = require('../models/Event');
const ShipmentReadModel = require('../models/ShipmentReadModel');

/**
 * Pure state transformer projecting a single domain event into the shipment read model state.
 *
 * @param {Object|null} priorState - The existing snapshot of the shipment read model
 * @param {Object} event - The domain event to project
 * @returns {Object} Updated read model state
 */
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

  const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();

  switch (event.eventType) {
    case EVENT_TYPES.CONTAINER_CREATED:
      return {
        shipmentId: event.aggregateId,
        status: 'CREATED',
        currentLocation: event.payload?.origin ?? null,
        cargo: event.payload?.cargo ?? null,
        temperature: null,
        vessel: null,
        lastAppliedVersion: event.version,
        lastEventTimestamp: timestamp
      };

    case EVENT_TYPES.LOADED_ON_SHIP:
      return {
        ...(priorState || {}),
        shipmentId: event.aggregateId,
        status: 'LOADED',
        vessel: event.payload?.vessel ?? priorState?.vessel ?? null,
        currentLocation:
          event.payload?.port ??
          event.payload?.location ??
          priorState?.currentLocation ??
          null,
        cargo: priorState?.cargo ?? null,
        temperature: priorState?.temperature ?? null,
        lastAppliedVersion: event.version,
        lastEventTimestamp: timestamp
      };

    case EVENT_TYPES.TEMPERATURE_SPIKE:
      return {
        ...(priorState || {}),
        shipmentId: event.aggregateId,
        status: 'TEMPERATURE_SPIKE',
        temperature:
          event.payload?.temperature ?? priorState?.temperature ?? null,
        vessel: priorState?.vessel ?? null,
        currentLocation: priorState?.currentLocation ?? null,
        cargo: priorState?.cargo ?? null,
        lastAppliedVersion: event.version,
        lastEventTimestamp: timestamp
      };

    case EVENT_TYPES.ARRIVED_AT_PORT:
      return {
        ...(priorState || {}),
        shipmentId: event.aggregateId,
        status: 'ARRIVED',
        currentLocation:
          event.payload?.port ??
          event.payload?.location ??
          priorState?.currentLocation ??
          null,
        temperature: priorState?.temperature ?? null,
        vessel: priorState?.vessel ?? null,
        cargo: priorState?.cargo ?? null,
        lastAppliedVersion: event.version,
        lastEventTimestamp: timestamp
      };

    default:
      throw new Error(`Unsupported event type: ${event.eventType}`);
  }
}

/**
 * Idempotently applies a domain event to the persistent ShipmentReadModel.
 *
 * @param {Object} event - The domain event to apply
 * @returns {Promise<Object>} { applied: boolean, reason: string, version: number, shipmentId: string }
 */
async function applyEventToReadModel(event) {
  if (!event || !event.aggregateId) {
    throw new Error('event with aggregateId is required');
  }

  let doc = await ShipmentReadModel.findOne({ shipmentId: event.aggregateId });

  if (doc && doc.lastAppliedVersion >= event.version) {
    return {
      applied: false,
      reason: 'ALREADY_APPLIED',
      version: event.version,
      shipmentId: event.aggregateId
    };
  }

  const priorState = doc
    ? typeof doc.toObject === 'function'
      ? doc.toObject()
      : doc
    : null;

  const nextState = projectEvent(priorState, event);

  if (doc) {
    Object.assign(doc, nextState);
    await doc.save();
  } else {
    doc = new ShipmentReadModel(nextState);
    await doc.save();
  }

  return {
    applied: true,
    reason: 'APPLIED',
    version: event.version,
    shipmentId: event.aggregateId
  };
}

/**
 * Replays all historical events for an aggregateId from scratch and rebuilds its read model.
 *
 * @param {string} aggregateId
 * @returns {Promise<Object>} Rebuilt read model document
 */
async function rebuildShipmentReadModel(aggregateId) {
  const eventsQuery = Event.find({ aggregateId });
  const events = typeof eventsQuery.sort === 'function'
    ? await eventsQuery.sort({ version: 1 })
    : await eventsQuery;

  let state = null;
  for (const evt of events) {
    state = projectEvent(state, evt);
  }

  if (!state) {
    return null;
  }

  let doc = await ShipmentReadModel.findOne({ shipmentId: aggregateId });
  if (doc) {
    Object.assign(doc, state);
    await doc.save();
  } else {
    doc = new ShipmentReadModel(state);
    await doc.save();
  }

  return doc;
}

module.exports = {
  projectEvent,
  applyEventToReadModel,
  rebuildShipmentReadModel
};
