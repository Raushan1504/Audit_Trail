
const queryService = require('./queryService');

const getShipmentState = async (request, response, next) => {
	try {
		const shipmentId = request.params.id || request.params.shipmentId;

		const startHrTime = process.hrtime();
		const shipmentState = await queryService.getShipmentState(shipmentId);
		const [seconds, nanoseconds] = process.hrtime(startHrTime);
		const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(3);

		if (!shipmentState) {
			return response.status(404).json({
				success: false,
				message: `Shipment '${shipmentId}' not found.`,
			});
		}

		response.setHeader('X-Query-Source', shipmentState._source || 'ShipmentReadModel');
		response.setHeader('X-Response-Time-Ms', durationMs);

		return response.status(200).json({
			success: true,
			data: shipmentState,
		});
	} catch (error) {
		next(error);
	}
};

const getShipmentEvents = async (request, response, next) => {
	try {
		const shipmentId = request.params.shipmentId || request.params.id;

		const events = await queryService.getShipmentEvents(shipmentId);

		return response.status(200).json({
			success: true,
			data: events,
		});
	} catch (error) {
		next(error);
	}
};

const listShipments = async (request, response, next) => {
	try {
		const shipments = await queryService.listShipments();

		return response.status(200).json({
			success: true,
			data: shipments,
		});
	} catch (error) {
		next(error);
	}
};

const getShipmentStateAsOf = async (request, response, next) => {
	try {
		const shipmentId = request.params.id || request.params.shipmentId;
		const target = request.params.target;

		const startHrTime = process.hrtime();
		const shipmentState = await queryService.getShipmentStateAsOf(shipmentId, target);
		const [seconds, nanoseconds] = process.hrtime(startHrTime);
		const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(3);

		if (!shipmentState) {
			return response.status(404).json({
				success: false,
				message: `Shipment '${shipmentId}' not found.`,
			});
		}

		response.setHeader('X-Query-Source', shipmentState._source || 'historical_reconstruction');
		response.setHeader('X-Response-Time-Ms', durationMs);

		return response.status(200).json({
			success: true,
			data: shipmentState,
		});
	} catch (error) {
		next(error);
	}
};

const getShipmentTelemetry = async (request, response, next) => {
	try {
		const shipmentId = request.params.id || request.params.shipmentId;
		const options = {
			anomaliesOnly: request.query.anomaliesOnly === 'true' || request.query.filter === 'anomalies',
			severity: request.query.severity,
			cargoHint: request.query.cargo
		};
		const telemetry = await queryService.getShipmentTelemetry(shipmentId, options);

		if (!telemetry) {
			return response.status(404).json({
				success: false,
				message: `Shipment '${shipmentId}' not found.`,
			});
		}

		return response.status(200).json({
			success: true,
			data: telemetry,
		});
	} catch (error) {
		next(error);
	}
};

const getShipmentAnomalies = async (request, response, next) => {
	try {
		const shipmentId = request.params.id || request.params.shipmentId;
		const options = {
			severity: request.query.severity,
			cargoHint: request.query.cargo
		};
		const anomalies = await queryService.getCorrelatedAnomalies(shipmentId, options);

		if (!anomalies) {
			return response.status(404).json({
				success: false,
				message: `Shipment '${shipmentId}' not found.`,
			});
		}

		return response.status(200).json({
			success: true,
			data: anomalies,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = {
	getShipmentState,
	getShipmentStateAsOf,
	getShipmentEvents,
	getShipmentTelemetry,
	getShipmentAnomalies,
	listShipments,
};
