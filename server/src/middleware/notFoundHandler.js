const { NotFoundError } = require('../utils/errors');

/**
 * 404 Not Found Middleware
 *
 * Catches any request that did not match an existing route handler
 * and forwards a standardized NotFoundError to the global error middleware.
 */
function notFoundHandler(req, res, next) {
  const message = `Route ${req.method} ${req.originalUrl} not found`;
  next(new NotFoundError(message));
}

module.exports = notFoundHandler;
