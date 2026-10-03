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

// Fast O(1) Read Model queries: supports both :id and :shipmentId
router.get('/shipments/:id', queryController.getShipmentState);
router.get('/shipments/:shipmentId', queryController.getShipmentState);
router.get('/shipment/:id', queryController.getShipmentState);
router.get('/shipment/:shipmentId', queryController.getShipmentState);

// Historical "As-Of" point-in-time state reconstruction (version or ISO timestamp)
router.get('/shipments/:id/as-of/:target', queryController.getShipmentStateAsOf);
router.get('/shipments/:shipmentId/as-of/:target', queryController.getShipmentStateAsOf);
router.get('/shipment/:id/as-of/:target', queryController.getShipmentStateAsOf);
router.get('/shipment/:shipmentId/as-of/:target', queryController.getShipmentStateAsOf);

// Raw chronological event history queries
router.get('/shipments/:id/events', queryController.getShipmentEvents);
router.get('/shipments/:shipmentId/events', queryController.getShipmentEvents);
router.get('/shipment/:id/events', queryController.getShipmentEvents);
router.get('/shipment/:shipmentId/events', queryController.getShipmentEvents);

// Sensor telemetry time-series endpoint for Recharts visualization (Day 24)
router.get('/shipments/:id/telemetry', queryController.getShipmentTelemetry);
router.get('/shipments/:shipmentId/telemetry', queryController.getShipmentTelemetry);
router.get('/shipment/:id/telemetry', queryController.getShipmentTelemetry);
router.get('/shipment/:shipmentId/telemetry', queryController.getShipmentTelemetry);

module.exports = router;
