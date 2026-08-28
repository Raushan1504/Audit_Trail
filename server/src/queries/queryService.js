const { replayShipmentEvents } = require('../domain/shipmentReducer');
const eventStore = require('../events/eventStore');
const Event = require('../models/Event');

/**
 * Reconstruct the current state of a shipment by replaying its events.
 * @param {string} shipmentId - The aggregate ID of the shipment.
 * @returns {Promise<Object|null>} The reconstructed shipment state, or null if not found.
 */
const getShipmentState = async (shipmentId) => {
	const events = await eventStore.getEventsByAggregateId(shipmentId);
	if (!events || events.length === 0) {
		return null;
	}
	return replayShipmentEvents(shipmentId, events);
};

/**
 * Retrieve the raw chronological event history for a shipment.
 * @param {string} shipmentId - The aggregate ID of the shipment.
 * @returns {Promise<Array>} The ordered list of domain events.
 */
const getShipmentEvents = async (shipmentId) => {
	return await eventStore.getEventsByAggregateId(shipmentId);
};

/**
 * List all shipment summaries.
 * @returns {Promise<Array>} A list of shipment summary objects.
 */
const listShipments = async () => {
	const aggregateIds = await Event.distinct('aggregateId');
	const shipments = [];
	for (const shipmentId of aggregateIds) {
		const events = await eventStore.getEventsByAggregateId(shipmentId);
		if (events && events.length > 0) {
			const state = replayShipmentEvents(shipmentId, events);
			shipments.push(state);
		}
	}
	return shipments;
};

module.exports = {
	getShipmentState,
	getShipmentEvents,
	listShipments,
};
