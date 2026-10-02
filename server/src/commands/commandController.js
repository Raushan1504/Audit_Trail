const commandService = require('./commandService');

function getExpectedVersion(request) {
	if (request.body?.expectedVersion !== undefined && request.body?.expectedVersion !== null) {
		return request.body.expectedVersion;
	}
	const headerVal = request.headers['x-expected-version'] || request.headers['if-match'];
	if (headerVal !== undefined && headerVal !== null) {
		const clean = String(headerVal).replace(/["v]/gi, '').trim();
		const parsed = parseInt(clean, 10);
		if (!Number.isNaN(parsed)) return parsed;
	}
	return undefined;
}

const createShipment = async (request, response, next) => {
	try {
		const { shipmentId, origin, destination, cargo, modifiedBy } = request.body;
		const expectedVersion = getExpectedVersion(request);

		const result = await commandService.handleCreateShipment({
			shipmentId,
			origin,
			destination,
			cargo,
			expectedVersion,
			modifiedBy: modifiedBy || request.headers['x-operator-name'] || undefined
		});

		return response.status(201).json({
			success: true,
			message: 'Shipment created successfully.',
			data: result,
		});
	} catch (error) {
		next(error);
	}
};

const loadShipment = async (request, response, next) => {
	try {
		const { shipmentId } = request.params;
		const { vessel, port, modifiedBy } = request.body;
		const expectedVersion = getExpectedVersion(request);

		const result = await commandService.handleLoadShipment({
			shipmentId,
			vessel,
			port,
			expectedVersion,
			modifiedBy: modifiedBy || request.headers['x-operator-name'] || undefined
		});

		return response.status(200).json({
			success: true,
			message: 'Shipment loaded successfully.',
			data: result,
		});
	} catch (error) {
		next(error);
	}
};

const recordTemperatureSpike = async (request, response, next) => {
	try {
		const { shipmentId } = request.params;
		const {
			temperature,
			threshold,
			sensorId,
			humidity,
			batteryVoltage,
			ambientTemp,
			coordinates,
			gps,
			modifiedBy
		} = request.body;
		const expectedVersion = getExpectedVersion(request);

		const result = await commandService.handleTemperatureSpike({
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
			modifiedBy: modifiedBy || request.headers['x-operator-name'] || undefined
		});

		return response.status(200).json({
			success: true,
			message: 'Temperature spike recorded.',
			data: result,
		});
	} catch (error) {
		next(error);
	}
};

const arriveAtPort = async (request, response, next) => {
	try {
		const { shipmentId } = request.params;
		const { port, modifiedBy } = request.body;
		const expectedVersion = getExpectedVersion(request);

		const result = await commandService.handleArriveAtPort({
			shipmentId,
			port,
			expectedVersion,
			modifiedBy: modifiedBy || request.headers['x-operator-name'] || undefined
		});

		return response.status(200).json({
			success: true,
			message: 'Shipment arrival recorded.',
			data: result,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = {
	createShipment,
	loadShipment,
	recordTemperatureSpike,
	arriveAtPort,
};
