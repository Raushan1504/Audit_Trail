const { AppError } = require('../utils/errors');

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  let details = err.details || null;

  if (err.message && err.message.includes('append-only')) {
    statusCode = 403;
    code = 'IMMUTABLE_EVENT_STORE';
    message = err.message;
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON in request payload';
  }

  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.keys(err.errors).map((field) => ({
      field,
      message: err.errors[field].message,
    }));
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_FORMAT';
    message = `Invalid format for field '${err.path}': ${err.value}`;
  }

  let conflict = null;
  if (err.name === 'ConcurrencyException' || err.code === 'CONCURRENCY_CONFLICT' || (err.statusCode === 409 && err.details?.expectedVersion !== undefined)) {
    statusCode = 409;
    code = 'CONCURRENCY_CONFLICT';
    message = err.message;
    conflict = {
      shipmentId: err.shipmentId || err.details?.shipmentId || null,
      expectedVersion: err.expectedVersion !== undefined ? err.expectedVersion : (err.details?.expectedVersion ?? null),
      currentVersion: err.currentVersion !== undefined ? err.currentVersion : (err.details?.currentVersion ?? null),
      resolutionHint: err.resolutionHint || err.details?.resolutionHint || 'Reload latest shipment state and retry command with current version.',
      modifiedBy: err.modifiedBy || err.details?.modifiedBy || 'concurrent_operator'
    };
  }

  if (err.code === 11000) {
    statusCode = 409;
    const isVersionConflict = (err.keyPattern && err.keyPattern.aggregateId && err.keyPattern.version) ||
      (err.message && err.message.includes('aggregateId_1_version_1'));
    if (isVersionConflict) {
      code = 'CONCURRENCY_CONFLICT';
      message = 'Optimistic concurrency collision: aggregate version was already committed in event store';
      conflict = {
        shipmentId: err.keyValue?.aggregateId || null,
        expectedVersion: err.keyValue?.version !== undefined ? err.keyValue.version - 1 : null,
        currentVersion: err.keyValue?.version ?? null,
        resolutionHint: 'The aggregate version was committed by a concurrent transaction. Fetch latest state and retry.',
        modifiedBy: 'concurrent_operator'
      };
    } else {
      code = 'DUPLICATE_KEY_ERROR';
      message = 'Resource already exists with conflicting unique field';
    }
  }

  if (err.message && (
    err.message.startsWith('Invalid command') ||
    err.message.includes('must be created first') ||
    err.message.includes('already created') ||
    err.message.includes('Unknown shipment status') ||
    err.message.includes('is required') ||
    err.message.includes('targetVersion')
  )) {
    statusCode = err.statusCode || err.status || 400;
    code = err.code || 'INVALID_COMMAND';
    message = err.message;
  }

  if (err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
    statusCode = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'Database connection temporarily unavailable. Please check connectivity and retry.';
  }

  if (statusCode === 500 && !err.isOperational && process.env.NODE_ENV !== 'test') {
    console.error('Unhandled Server Error:', err);
  }

  const responseBody = {
    success: false,
    error: message,
    message: message,
    code: code,
    statusCode: statusCode,
    details: details,
  };

  if (conflict) {
    responseBody.conflict = conflict;
  }

  return res.status(statusCode).json(responseBody);
}

module.exports = errorHandler;
