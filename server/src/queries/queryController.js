/**
 * Query Controller
 *
 * Handles HTTP requests on the query (read) side of the CQRS boundary.
 * Each handler fetches or reconstructs state and returns it to the caller.
 * Query handlers must NEVER produce side-effects or mutate state —
 * that is the command side's job.
 */

const queryService = require('./queryService');

/**
 * GET /api/queries/shipments/:shipmentId
 * Returns the reconstructed current state of a shipment by replaying its events.
 */
const getShipmentState = async (request, response, next) => {
	try {
		const shipmentId = request.params.shipmentId || request.params.id;

		const shipmentState = await queryService.getShipmentState(shipmentId);

		if (!shipmentState) {
			return response.status(404).json({
				success: false,
				message: `Shipment '${shipmentId}' not found.`,
			});
		}

		return response.status(200).json({
			success: true,
			data: shipmentState,
		});
	} catch (error) {
		next(error);
	}
};

/**
 * GET /api/queries/shipments/:shipmentId/events
 * Returns the raw chronological event history for a shipment.
 */
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

/**
 * GET /api/queries/shipments
 * Returns a list of all shipment summaries (from the read model, when available).
 */
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

module.exports = {
	getShipmentState,
	getShipmentEvents,
	listShipments,
};
