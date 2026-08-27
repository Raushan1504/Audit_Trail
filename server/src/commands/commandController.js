

const commandService = require('./commandService');
const createShipment = async (request, response, next) => {
	try {
		const { shipmentId, origin, destination, cargo } = request.body;

		const result = await commandService.handleCreateShipment({
			shipmentId,
			origin,
			destination,
			cargo,
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
		const { vessel, port } = request.body;

		const result = await commandService.handleLoadShipment({
			shipmentId,
			vessel,
			port,
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
		const { temperature, threshold, sensorId } = request.body;

		const result = await commandService.handleTemperatureSpike({
			shipmentId,
			temperature,
			threshold,
			sensorId,
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
		const { port } = request.body;

		const result = await commandService.handleArriveAtPort({
			shipmentId,
			port,
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
