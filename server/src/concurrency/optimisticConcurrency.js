
const { ConcurrencyException, ValidationError, ConflictError } = require('../utils/errors');

function validateOptimisticLock({ currentVersion, expectedVersion, shipmentId, modifiedBy }) {
  if (expectedVersion === undefined || expectedVersion === null) {
    throw new ValidationError('expectedVersion is required for optimistic concurrency check');
  }

  const expected = Number(expectedVersion);
  if (!Number.isInteger(expected) || expected < 0) {
    throw new ValidationError('expectedVersion must be a non-negative integer');
  }

  if (expected !== currentVersion) {
    throw new ConcurrencyException(null, {
      shipmentId,
      expectedVersion: expected,
      currentVersion,
      modifiedBy: modifiedBy || 'another logistics operator',
      resolutionHint: `Shipment '${shipmentId}' was modified concurrently (current version is v${currentVersion}). Refresh latest state and retry with expectedVersion: ${currentVersion}.`
    });
  }

  return true;
}

function formatConflictResponse(err, fallbackCurrentVersion = null) {
  const currentVersion = err.currentVersion ?? err.details?.currentVersion ?? fallbackCurrentVersion;
  const expectedVersion = err.expectedVersion ?? err.details?.expectedVersion ?? null;
  const shipmentId = err.shipmentId ?? err.details?.shipmentId ?? null;
  const modifiedBy = err.modifiedBy ?? err.details?.modifiedBy ?? 'concurrent_operator';
  const resolutionHint = err.resolutionHint ?? err.details?.resolutionHint ??
    (currentVersion !== null
      ? `Reload the latest shipment state (version ${currentVersion}) and retry your command.`
      : 'Refresh aggregate state and retry.');

  return {
    success: false,
    error: err.message || 'Optimistic concurrency conflict occurred.',
    message: err.message || 'Optimistic concurrency conflict occurred.',
    code: 'CONCURRENCY_CONFLICT',
    statusCode: 409,
    conflict: {
      shipmentId,
      expectedVersion,
      currentVersion,
      modifiedBy,
      resolutionHint
    },
    details: err.details || null
  };
}

module.exports = {
  ConcurrencyException,
  validateOptimisticLock,
  formatConflictResponse,
};
