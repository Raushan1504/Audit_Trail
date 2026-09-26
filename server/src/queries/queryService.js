const { reconstructShipmentState } = require('../domain/shipmentReconstruction');
const eventStore = require('../events/eventStore');
const Event = require('../models/Event');
const ShipmentReadModel = require('../models/ShipmentReadModel');

/**
 * Fast O(1) read model query for shipment state.
 * Direct lookup against the indexed ShipmentReadModel collection for sub-millisecond response.
 * Falls back to deterministic event replay if the aggregate is not yet projected.
 *
 * @param {string} shipmentId - The aggregate ID of the shipment.
 * @returns {Promise<Object|null>} The shipment state or null if not found.
 */
const getShipmentState = async (shipmentId) => {
	if (!shipmentId || typeof shipmentId !== 'string') {
		return null;
	}

	const normalizedId = shipmentId.trim();

	// 1. Direct O(1) lookup on indexed ShipmentReadModel (sub-millisecond)
	const readModel = await ShipmentReadModel.findOne({ shipmentId: normalizedId });
	if (readModel) {
		const doc = typeof readModel.toObject === 'function' ? readModel.toObject() : readModel;
		return {
			shipmentId: doc.shipmentId,
			status: doc.status,
			currentLocation: doc.currentLocation ?? doc.location ?? null,
			location: doc.currentLocation ?? doc.location ?? null,
			temperature: doc.temperature ?? null,
			version: doc.lastAppliedVersion ?? doc.version ?? 0,
			lastAppliedVersion: doc.lastAppliedVersion ?? doc.version ?? 0,
			vessel: doc.vessel ?? null,
			cargo: doc.cargo ?? null,
			lastEventTimestamp: doc.lastEventTimestamp ?? null,
			createdAt: doc.createdAt ?? null,
			updatedAt: doc.updatedAt ?? null,
			_source: 'read_model'
		};
	}

	// 2. Resilient fallback: reconstruct from event store if not yet projected
	const events = await eventStore.getEventsByAggregateId(normalizedId);
	if (!events || events.length === 0) {
		return null;
	}

	const replayedState = reconstructShipmentState(normalizedId, events);
	return {
		...replayedState,
		currentLocation: replayedState.location ?? replayedState.currentLocation ?? null,
		lastAppliedVersion: replayedState.version ?? replayedState.lastAppliedVersion ?? 0,
		_source: 'event_replay'
	};
};

/**
 * Retrieve the raw chronological event history for a shipment.
 * @param {string} shipmentId - The aggregate ID of the shipment.
 * @returns {Promise<Array>} The ordered list of domain events.
 */
const getShipmentEvents = async (shipmentId) => {
	if (!shipmentId || typeof shipmentId !== 'string') {
		return [];
	}
	return await eventStore.getEventsByAggregateId(shipmentId.trim());
};

/**
 * List all shipment summaries directly from ShipmentReadModel for high performance.
 * Falls back to Event Store distinct aggregation if the read model collection is empty.
 *
 * @returns {Promise<Array>} A list of shipment summary objects.
 */
const listShipments = async () => {
	const readModels = await ShipmentReadModel.find().sort({ updatedAt: -1 });
	if (readModels && readModels.length > 0) {
		return readModels.map((readModel) => {
			const doc = typeof readModel.toObject === 'function' ? readModel.toObject() : readModel;
			return {
				shipmentId: doc.shipmentId,
				status: doc.status,
				currentLocation: doc.currentLocation ?? doc.location ?? null,
				location: doc.currentLocation ?? doc.location ?? null,
				temperature: doc.temperature ?? null,
				version: doc.lastAppliedVersion ?? doc.version ?? 0,
				lastAppliedVersion: doc.lastAppliedVersion ?? doc.version ?? 0,
				vessel: doc.vessel ?? null,
				cargo: doc.cargo ?? null,
				lastEventTimestamp: doc.lastEventTimestamp ?? null,
				createdAt: doc.createdAt ?? null,
				updatedAt: doc.updatedAt ?? null,
				_source: 'read_model'
			};
		});
	}

	// Fallback to event store replay if read model hasn't been seeded or projected
	const aggregateIds = await Event.distinct('aggregateId');
	const shipments = [];
	for (const shipmentId of aggregateIds) {
		const events = await eventStore.getEventsByAggregateId(shipmentId);
		if (events && events.length > 0) {
			const state = reconstructShipmentState(shipmentId, events);
			shipments.push({
				...state,
				currentLocation: state.location ?? state.currentLocation ?? null,
				lastAppliedVersion: state.version ?? state.lastAppliedVersion ?? 0,
				_source: 'event_replay'
			});
		}
	}
	return shipments;
};

module.exports = {
	getShipmentState,
	getShipmentEvents,
	listShipments,
};
