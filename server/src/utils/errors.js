/**
 * Custom Application Error Hierarchy
 *
 * Defines standardized operational errors used across the backend
 * to ensure consistent HTTP status codes, error codes, and formats.
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
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
  constructor(message = 'Resource already exists or conflict occurred') {
    super(message, 409, 'CONFLICT');
  }
}

class ConcurrencyException extends ConflictError {
  constructor(message, options = {}) {
    const {
      shipmentId = null,
      expectedVersion = null,
      currentVersion = null,
      modifiedBy = 'concurrent_operator',
      resolutionHint = null
    } = typeof options === 'object' && options !== null ? options : {};

    const defaultMsg = shipmentId
      ? `Optimistic concurrency conflict on shipment '${shipmentId}': expected version ${expectedVersion}, but current database version is ${currentVersion}.`
      : 'Optimistic concurrency conflict: aggregate was modified by a concurrent transaction.';

    super(message || defaultMsg);

    this.name = 'ConcurrencyException';
    this.code = 'CONCURRENCY_CONFLICT';
    this.statusCode = 409;
    this.shipmentId = shipmentId;
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
    this.modifiedBy = modifiedBy;
    this.resolutionHint = resolutionHint ||
      (currentVersion !== null
        ? `Reload the latest shipment state (version ${currentVersion}) and retry your command with expectedVersion: ${currentVersion}.`
        : 'Fetch the latest aggregate version and reapply your command.');

    this.details = {
      shipmentId: this.shipmentId,
      expectedVersion: this.expectedVersion,
      currentVersion: this.currentVersion,
      modifiedBy: this.modifiedBy,
      resolutionHint: this.resolutionHint
    };
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
  InternalServerError,
};
