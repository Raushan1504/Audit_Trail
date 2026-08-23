const { createInitialShipmentState } = require('./shipmentState');

function createShipmentAggregate(shipmentId) {
  if (!shipmentId) {
    throw new Error('shipmentId is required');
  }

  return {
    state: createInitialShipmentState(shipmentId)
  };
}

module.exports = {
  createShipmentAggregate
};