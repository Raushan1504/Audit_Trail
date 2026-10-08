
const express = require('express');
const router = express.Router();
const queryController = require('./queryController');

router.get('/shipments', queryController.listShipments);

router.get('/shipments/:id', queryController.getShipmentState);
router.get('/shipments/:shipmentId', queryController.getShipmentState);
router.get('/shipment/:id', queryController.getShipmentState);
router.get('/shipment/:shipmentId', queryController.getShipmentState);

router.get('/shipments/:id/as-of/:target', queryController.getShipmentStateAsOf);
router.get('/shipments/:shipmentId/as-of/:target', queryController.getShipmentStateAsOf);
router.get('/shipment/:id/as-of/:target', queryController.getShipmentStateAsOf);
router.get('/shipment/:shipmentId/as-of/:target', queryController.getShipmentStateAsOf);

router.get('/shipments/:id/events', queryController.getShipmentEvents);
router.get('/shipments/:shipmentId/events', queryController.getShipmentEvents);
router.get('/shipment/:id/events', queryController.getShipmentEvents);
router.get('/shipment/:shipmentId/events', queryController.getShipmentEvents);

router.get('/shipments/:id/telemetry', queryController.getShipmentTelemetry);
router.get('/shipments/:shipmentId/telemetry', queryController.getShipmentTelemetry);
router.get('/shipment/:id/telemetry', queryController.getShipmentTelemetry);
router.get('/shipment/:shipmentId/telemetry', queryController.getShipmentTelemetry);

router.get('/shipments/:id/anomalies', queryController.getShipmentAnomalies);
router.get('/shipments/:shipmentId/anomalies', queryController.getShipmentAnomalies);
router.get('/shipment/:id/anomalies', queryController.getShipmentAnomalies);
router.get('/shipment/:shipmentId/anomalies', queryController.getShipmentAnomalies);

module.exports = router;
