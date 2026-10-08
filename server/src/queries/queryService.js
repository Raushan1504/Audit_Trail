const {
	reconstructShipmentState,
	reconstructStateAsOf,
	reconstructStateAsOfTimestamp
} = require('../domain/shipmentReconstruction');
const eventStore = require('../events/eventStore');
const Event = require('../models/Event');
const ShipmentReadModel = require('../models/ShipmentReadModel');
const { BadRequestError } = require('../utils/errors');

const getShipmentState = async (shipmentId) => {
	if (!shipmentId || typeof shipmentId !== 'string') {
		return null;
	}

	const normalizedId = shipmentId.trim();

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

const getShipmentEvents = async (shipmentId) => {
	if (!shipmentId || typeof shipmentId !== 'string') {
		return [];
	}
	return await eventStore.getEventsByAggregateId(shipmentId.trim());
};

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

const getShipmentStateAsOf = async (shipmentId, target) => {
	if (!shipmentId || typeof shipmentId !== 'string') {
		return null;
	}

	if (target === undefined || target === null || String(target).trim() === '') {
		throw new BadRequestError('Target parameter is required (version or ISO timestamp)');
	}

	const normalizedId = shipmentId.trim();
	const targetStr = String(target).trim();

	const events = await eventStore.getEventsByAggregateId(normalizedId);
	if (!events || events.length === 0) {
		return null;
	}

	const sortedEvents = events
		.map((e) => (typeof e.toObject === 'function' ? e.toObject() : e))
		.sort((a, b) => a.version - b.version);

	let historicalState;
	let asOfType;
	let targetVersionNum;
	let targetTimestampIso;

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

const { detectEventAnomaly, resolveCargoProfile } = require('../domain/anomalyDetector');

const getShipmentTelemetry = async (shipmentId, options = {}) => {
	if (!shipmentId || typeof shipmentId !== 'string') {
		return null;
	}

	const normalizedId = shipmentId.trim();
	const events = await eventStore.getEventsByAggregateId(normalizedId);
	if (!events || events.length === 0) {
		return null;
	}

	const sortedEvents = events
		.map((e) => (typeof e.toObject === 'function' ? e.toObject() : e))
		.sort((a, b) => a.version - b.version);

	const creationEvent = sortedEvents.find((e) => e.eventType === 'CONTAINER_CREATED');
	const cargoHint = options.cargoHint || creationEvent?.payload?.cargo || 'PERISHABLE';
	const cargoProfile = resolveCargoProfile(cargoHint);

	let lastKnownTemp = 4.0;
	let lastKnownThreshold = cargoProfile.maxTemperature;
	let lastKnownHumidity = 55.0;
	let lastKnownVoltage = 3.82;
	let lastKnownAmbient = 22.0;

	let timeSeries = sortedEvents.map((event) => {
		const payload = event.payload || {};
		const isSpike = event.eventType === 'TEMPERATURE_SPIKE';

		if (payload.temperature !== undefined && payload.temperature !== null) {
			lastKnownTemp = Number(payload.temperature);
		} else if (event.eventType === 'CONTAINER_CREATED') {
			lastKnownTemp = 3.8;
		} else if (event.eventType === 'LOADED_ON_SHIP') {
			lastKnownTemp = 4.1;
		} else if (event.eventType === 'ARRIVED_AT_PORT') {
			lastKnownTemp = 4.0;
		}

		if (payload.threshold !== undefined && payload.threshold !== null) {
			lastKnownThreshold = Number(payload.threshold);
		}

		if (payload.humidity !== undefined && payload.humidity !== null) {
			lastKnownHumidity = Number(payload.humidity);
		} else if (isSpike) {
			lastKnownHumidity = 78.4;
		}

		if (payload.batteryVoltage !== undefined && payload.batteryVoltage !== null) {
			lastKnownVoltage = Number(payload.batteryVoltage);
		}

		if (payload.ambientTemp !== undefined && payload.ambientTemp !== null) {
			lastKnownAmbient = Number(payload.ambientTemp);
		} else if (isSpike) {
			lastKnownAmbient = 26.5;
		}

		const timestampIso = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();
		const explicitTemp = payload.temperature !== undefined && payload.temperature !== null ? Number(payload.temperature) : null;
		const effectiveThreshold = payload.threshold !== undefined && payload.threshold !== null ? Number(payload.threshold) : lastKnownThreshold;

		const anomalyMeta = detectEventAnomaly(event, cargoProfile.type);
		const isAnomaly = isSpike || anomalyMeta.isAnomaly || (explicitTemp !== null && explicitTemp > effectiveThreshold);
		const severity = isAnomaly ? (anomalyMeta.severity !== 'NORMAL' ? anomalyMeta.severity : 'CRITICAL') : 'NORMAL';

		const eventIdStr = String(event._id || event.id || `evt-${event.version}`);

		return {
			version: event.version,
			eventId: eventIdStr,
			eventType: event.eventType,
			timestamp: timestampIso,
			temperature: Number(lastKnownTemp.toFixed(1)),
			threshold: Number(lastKnownThreshold.toFixed(1)),
			humidity: Number(lastKnownHumidity.toFixed(1)),
			batteryVoltage: Number(lastKnownVoltage.toFixed(2)),
			ambientTemp: Number(lastKnownAmbient.toFixed(1)),
			sensorId: payload.sensorId || 'SENSOR-IOT-01',
			location: payload.port || payload.location || payload.origin || payload.destination || null,
			coordinates: payload.coordinates || payload.gps || null,
			isAnomaly,
			severity,
			cargoProfile: cargoProfile.type,
			breaches: anomalyMeta.breaches || [],
			anomalySummary: anomalyMeta.summary,

			coincidence: {
				eventId: eventIdStr,
				eventType: event.eventType,
				version: event.version,
				timestamp: timestampIso,
				description: isAnomaly
					? `Anomaly detected coinciding with ${event.eventType} event at version ${event.version}`
					: `Nominal reading synchronized with ${event.eventType}`
			}
		};
	});

	if (options.anomaliesOnly || options.filter === 'anomalies') {
		timeSeries = timeSeries.filter((p) => p.isAnomaly);
	}

	if (options.severity) {
		const targetSev = String(options.severity).toUpperCase();
		timeSeries = timeSeries.filter((p) => p.severity === targetSev);
	}

	const temps = timeSeries.map((p) => p.temperature);
	const minTemp = temps.length > 0 ? Math.min(...temps) : 0;
	const maxTemp = temps.length > 0 ? Math.max(...temps) : 0;
	const avgTemp = temps.length > 0 ? Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)) : 0;
	const anomaliesCount = timeSeries.filter((p) => p.isAnomaly).length;

	return {
		shipmentId: normalizedId,
		cargoProfile: cargoProfile.type,
		totalDataPoints: timeSeries.length,
		metrics: {
			minTemperature: minTemp,
			maxTemperature: maxTemp,
			avgTemperature: avgTemp,
			criticalThreshold: lastKnownThreshold,
			anomaliesDetected: anomaliesCount,
			latestBatteryVoltage: lastKnownVoltage,
			latestHumidity: lastKnownHumidity
		},
		timeSeries
	};
};

const getCorrelatedAnomalies = async (shipmentId, options = {}) => {
	const telemetry = await getShipmentTelemetry(shipmentId, { ...options, anomaliesOnly: true });
	if (!telemetry) {
		return null;
	}

	return {
		shipmentId: telemetry.shipmentId,
		cargoProfile: telemetry.cargoProfile,
		totalAnomalies: telemetry.timeSeries.length,
		criticalCount: telemetry.timeSeries.filter((a) => a.severity === 'CRITICAL').length,
		warningCount: telemetry.timeSeries.filter((a) => a.severity === 'WARNING').length,
		anomalies: telemetry.timeSeries
	};
};

module.exports = {
	getShipmentState,
	getShipmentStateAsOf,
	getShipmentEvents,
	getShipmentTelemetry,
	getCorrelatedAnomalies,
	listShipments,
};
