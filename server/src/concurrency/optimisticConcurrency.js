/**
 * Optimistic Concurrency Control (OCC) Module (Day 23)
 *
 * Implements version checking, conflict detection, resolution hints,
 * and standard 409 response shaping for concurrent domain commands.
 */

const { ConcurrencyException, ValidationError, ConflictError } = require('../utils/errors');

/**
 * Validates optimistic lock between expectedVersion and current aggregate version.
 *
 * @param {Object} params
 * @param {number} params.currentVersion - The live aggregate version in the event store.
 * @param {*} params.expectedVersion - The version the client asserts when issuing the command.
 * @param {string} params.shipmentId - The aggregate ID.
 * @param {string} [params.modifiedBy] - The operator or service that performed the update.
 * @returns {boolean} true if version matches.
 * @throws {ValidationError} if expectedVersion is not a non-negative integer.
 * @throws {ConcurrencyException} if expectedVersion does not match currentVersion.
 */
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

/**
 * Formats a standardized HTTP 409 Conflict payload for OCC violations.
 *
 * @param {Error|ConcurrencyException} err
 * @param {number} [fallbackCurrentVersion]
 * @returns {Object} Standardized 409 response object.
 */
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
