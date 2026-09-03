const { AppError } = require('../utils/errors');

/**
 * Global Express Error Handling Middleware
 *
 * Catches all errors forwarded by next(err) or thrown in async handlers,
 * formats them into a predictable and standardized JSON structure,
 * and sets the appropriate HTTP status code.
 *
 * Standard Error Response Shape:
 * {
 *   "success": false,
 *   "error": "Error message",
 *   "message": "Error message",
 *   "code": "ERROR_CODE",
 *   "statusCode": 400,
 *   "details": null | [ ... ]
 * }
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  let details = err.details || null;

  // Handle express/body-parser JSON parse errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON in request payload';
  }

  // Handle Mongoose / MongoDB validation errors
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.keys(err.errors).map((field) => ({
      field,
      message: err.errors[field].message,
    }));
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId/type)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_FORMAT';
    message = `Invalid format for field '${err.path}': ${err.value}`;
  }

  // Handle MongoDB duplicate key errors (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY_ERROR';
    message = 'Resource already exists with conflicting unique field';
  }

  // Fallback for default Error instances with message indicating bad request / validation
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

  return res.status(statusCode).json(responseBody);
}

module.exports = errorHandler;
