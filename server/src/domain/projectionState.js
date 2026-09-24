function createInitialProjectionState(shipmentId) {
  if (!shipmentId) {
    throw new Error('shipmentId is required');
  }

  return {
    shipmentId,
    location: null,
    status: 'CREATED',
    temperature: null,
    vessel: null,
    version: 0
  };
}

module.exports = {
  createInitialProjectionState
};
