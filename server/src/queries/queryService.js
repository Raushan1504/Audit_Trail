const {
	reconstructShipmentState,
	reconstructStateAsOf,
	reconstructStateAsOfTimestamp
} = require('../domain/shipmentReconstruction');
const eventStore = require('../events/eventStore');
const Event = require('../models/Event');
const ShipmentReadModel = require('../models/ShipmentReadModel');
const { BadRequestError } = require('../utils/errors');

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

/**
 * Reconstruct historical shipment state as of a target version or timestamp.
 * Reads solely from the immutable Event Store without mutating the live ShipmentReadModel.
 *
 * @param {string} shipmentId - The aggregate ID of the shipment.
 * @param {string|number} target - The target version (e.g. 2, "2", "v2") or ISO timestamp.
 * @returns {Promise<Object|null>} The historical reconstructed shipment state.
 */
const getShipmentStateAsOf = async (shipmentId, target) => {
	if (!shipmentId || typeof shipmentId !== 'string') {
		return null;
	}

	if (target === undefined || target === null || String(target).trim() === '') {
		throw new BadRequestError('Target parameter is required (version or ISO timestamp)');
	}

	const normalizedId = shipmentId.trim();
	const targetStr = String(target).trim();

	// Fetch raw immutable events from EventStore
	const events = await eventStore.getEventsByAggregateId(normalizedId);
	if (!events || events.length === 0) {
		return null;
	}

	// Ensure plain objects and sort sequentially by version
	const sortedEvents = events
		.map((e) => (typeof e.toObject === 'function' ? e.toObject() : e))
		.sort((a, b) => a.version - b.version);

	let historicalState;
	let asOfType;
	let targetVersionNum;
	let targetTimestampIso;

	// Check if target is a version (e.g. "2", "0", "v2")
	const isVersionPattern = /^v?([0-9]+)$/i;
	const versionMatch = targetStr.match(isVersionPattern);

	if (versionMatch) {
		asOfType = 'version';
		targetVersionNum = parseInt(versionMatch[1], 10);

		try {
			historicalState = reconstructStateAsOf(normalizedId, sortedEvents, targetVersionNum);
		} catch (err) {
			throw new BadRequestError(err.message);
		}
	} else {
		// Attempt timestamp-based historical cutoff
		const parsedDate = new Date(targetStr);
		if (Number.isNaN(parsedDate.getTime())) {
			throw new BadRequestError(
				`Invalid target '${targetStr}': must be a non-negative integer version (e.g. 2) or a valid ISO timestamp (e.g. 2026-08-01T14:00:00.000Z)`
			);
		}

		asOfType = 'timestamp';
		targetTimestampIso = parsedDate.toISOString();

		try {
			historicalState = reconstructStateAsOfTimestamp(normalizedId, sortedEvents, targetTimestampIso);
		} catch (err) {
			throw new BadRequestError(err.message);
		}
	}

	const effectiveVersion = historicalState.version ?? 0;
	const effectiveEvents = sortedEvents.filter((e) => e.version <= effectiveVersion);
	const lastHistoricalEvent = effectiveEvents[effectiveEvents.length - 1] || null;

	const creationEvent = effectiveEvents.find((e) => e.eventType === 'CONTAINER_CREATED');
	const cargo = creationEvent?.payload?.cargo
		? (typeof creationEvent.payload.cargo === 'object'
			? (creationEvent.payload.cargo.description || creationEvent.payload.cargo.name || JSON.stringify(creationEvent.payload.cargo))
			: String(creationEvent.payload.cargo))
		: null;

	return {
		shipmentId: normalizedId,
		status: historicalState.status,
		currentLocation: historicalState.location ?? creationEvent?.payload?.origin ?? null,
		location: historicalState.location ?? creationEvent?.payload?.origin ?? null,
		temperature: historicalState.temperature ?? null,
		version: effectiveVersion,
		lastAppliedVersion: effectiveVersion,
		vessel: historicalState.vessel ?? null,
		cargo: cargo,
		lastEventTimestamp: lastHistoricalEvent?.timestamp ?? null,
		_source: 'historical_reconstruction',
		asOf: {
			target: targetStr,
			type: asOfType,
			targetVersion: asOfType === 'version' ? targetVersionNum : undefined,
			targetTimestamp: asOfType === 'timestamp' ? targetTimestampIso : undefined,
			effectiveVersion: effectiveVersion,
			totalHistoricalEvents: effectiveEvents.length,
			totalAvailableEvents: sortedEvents.length
		}
	};
};

module.exports = {
	getShipmentState,
	getShipmentStateAsOf,
	getShipmentEvents,
	listShipments,
};
