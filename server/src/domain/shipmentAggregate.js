const { createInitialShipmentState } = require('./shipmentState');
const { ConflictError, ValidationError } = require('../utils/errors');

function createShipmentAggregate(shipmentId) {
  if (!shipmentId) {
    throw new ValidationError('shipmentId is required');
  }

  const state = createInitialShipmentState(shipmentId);

  return {
    state,

    checkVersion(expectedVersion) {
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
        throw new ValidationError('expectedVersion must be a non-negative integer');
      }

      if (expectedVersion !== state.version) {
        throw new ConflictError(
          `Version conflict: expected version ${expectedVersion}, current version ${state.version}`
        );
      }

      return true;
    }
  };
}

module.exports = {
  createShipmentAggregate
};
