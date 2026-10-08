
const express = require('express');
const router = express.Router();
const commandController = require('./commandController');

router.post('/shipments/create', commandController.createShipment);

router.post('/shipments/:shipmentId/load', commandController.loadShipment);

router.post('/shipments/:shipmentId/temperature-spike', commandController.recordTemperatureSpike);

router.post('/shipments/:shipmentId/arrive', commandController.arriveAtPort);

module.exports = router;
