function createInitialShipmentState(shipmentId) {
  return {
    shipmentId,
    location: null,
    status: 'CREATED',
    temperature: null,
    version: 0
  };
}

module.exports = {
  createInitialShipmentState
};