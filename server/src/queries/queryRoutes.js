/**
 * Query Routes
 *
 * Defines the /api/queries route boundary (the read side of CQRS).
 * All routes in this module are pure reads — they reconstruct or
 * fetch state without producing side-effects.
 * They must NOT create events or mutate data — that belongs in commandRoutes.
 *
 * Route structure:
 *   GET /api/queries/shipments                    → List all shipment summaries
 *   GET /api/queries/shipments/:shipmentId        → Get reconstructed shipment state
 *   GET /api/queries/shipments/:shipmentId/events → Get raw event history
 */

const express = require('express');
const router = express.Router();
const queryController = require('./queryController');

// --- Shipment Queries ---

router.get('/shipments', queryController.listShipments);

router.get('/shipments/:shipmentId', queryController.getShipmentState);

router.get('/shipments/:shipmentId/events', queryController.getShipmentEvents);

module.exports = router;
