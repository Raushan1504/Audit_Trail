

/**
 * Reconstruct the current state of a shipment by replaying its events.
 * @param {string} shipmentId - The aggregate ID of the shipment.
 * @returns {Promise<Object|null>} The reconstructed shipment state, or null if not found.
 */
const getShipmentState = async (shipmentId) => {
	throw new Error('getShipmentState is not yet implemented. Scheduled for Day 7.');
};

/**
 * Retrieve the raw chronological event history for a shipment.
 * @param {string} shipmentId - The aggregate ID of the shipment.
 * @returns {Promise<Array>} The ordered list of domain events.
 */
const getShipmentEvents = async (shipmentId) => {
	// Day 7: fetch events from event store ordered by version/timestamp
	throw new Error('getShipmentEvents is not yet implemented. Scheduled for Day 7.');
};

/**
 * List all shipment summaries.
 * @returns {Promise<Array>} A list of shipment summary objects.
 */
const listShipments = async () => {
	// Day 7 / Week 3: query from read model or derive from event store
	throw new Error('listShipments is not yet implemented. Scheduled for Day 7.');
};

module.exports = {
	getShipmentState,
	getShipmentEvents,
	listShipments,
};
