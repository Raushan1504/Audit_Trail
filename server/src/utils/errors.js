
class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = 'INTERNAL_SERVER_ERROR',
    details = null
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(
    message = 'Resource already exists or conflict occurred',
    details = null
  ) {
    super(message, 409, 'CONFLICT', details);
  }
}

class ConcurrencyException extends ConflictError {
  constructor(input, options = {}) {
    let message;
    let shipmentId;
    let expectedVersion;
    let currentVersion;
    let modifiedBy;
    let resolutionHint;

    if (
      input &&
      typeof input === 'object' &&
      !Array.isArray(input)
    ) {
      shipmentId = input.shipmentId;
      expectedVersion = input.expectedVersion;
      currentVersion = input.currentVersion;
      modifiedBy = input.modifiedBy;
      resolutionHint = input.resolutionHint;
      message = input.message;
    } else {

      message = input;

      shipmentId = options?.shipmentId;
      expectedVersion = options?.expectedVersion;
      currentVersion = options?.currentVersion;
      modifiedBy = options?.modifiedBy;
      resolutionHint = options?.resolutionHint;
    }

    const defaultMessage =
      shipmentId !== undefined && shipmentId !== null
        ? `Optimistic concurrency conflict on shipment '${shipmentId}': expected version ${expectedVersion}, but current database version is ${currentVersion}.`
        : 'Optimistic concurrency conflict: aggregate was modified by a concurrent transaction.';

    const defaultResolutionHint =
      currentVersion !== undefined && currentVersion !== null
        ? `Reload the latest shipment state (version ${currentVersion}) and retry your command with expectedVersion: ${currentVersion}.`
        : 'Fetch the latest aggregate version and reapply your command.';

    const finalResolutionHint =
      resolutionHint || defaultResolutionHint;

    const details = {
      shipmentId: shipmentId ?? null,
      expectedVersion: expectedVersion ?? null,
      currentVersion: currentVersion ?? null,
      ...(modifiedBy !== undefined && {
        modifiedBy
      }),
      resolutionHint: finalResolutionHint,
      resolution: finalResolutionHint
    };

    super(
      message || defaultMessage,
      details
    );

    this.name = 'ConcurrencyException';
    this.code = 'CONCURRENCY_CONFLICT';

    this.shipmentId = shipmentId ?? null;
    this.expectedVersion = expectedVersion ?? null;
    this.currentVersion = currentVersion ?? null;
    this.modifiedBy = modifiedBy ?? null;

    this.resolutionHint = finalResolutionHint;

    this.details = details;
  }
}

class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

module.exports = {
  AppError,
  ValidationError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  ConcurrencyException,
  InternalServerError
};
