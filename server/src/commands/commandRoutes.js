/**
 * Command Routes
 *
 * Defines the /api/commands route boundary (the write side of CQRS).
 * All routes in this module produce side-effects (domain events).
 * They must NOT return query/read data — that belongs in queryRoutes.
 *
 * Route structure:
 *   POST /api/commands/shipments/create           → Create a new shipment
 *   POST /api/commands/shipments/:shipmentId/load  → Load shipment onto vessel
 *   POST /api/commands/shipments/:shipmentId/temperature-spike → Record temp spike
 *   POST /api/commands/shipments/:shipmentId/arrive → Record port arrival
 */

const express = require('express');
const router = express.Router();
const commandController = require('./commandController');

// --- Shipment Commands ---

router.post('/shipments/create', commandController.createShipment);

router.post('/shipments/:shipmentId/load', commandController.loadShipment);

router.post('/shipments/:shipmentId/temperature-spike', commandController.recordTemperatureSpike);

router.post('/shipments/:shipmentId/arrive', commandController.arriveAtPort);

module.exports = router;
