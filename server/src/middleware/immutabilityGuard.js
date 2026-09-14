const Event = require('../models/Event');

/**
 * Immutability Guard Middleware
 *
 * Enforces the append-only constraint at the HTTP boundary.
 * Any attempt to mutate or delete existing events or historical state via
 * PUT, PATCH, or DELETE is rejected with HTTP 403 Forbidden.
 */
function immutabilityGuard(req, res, next) {
  const method = req.method.toUpperCase();
  if (['PUT', 'PATCH', 'DELETE'].includes(method)) {
    return res.status(403).json({
      success: false,
      error: Event.APPEND_ONLY_MSG,
      message: Event.APPEND_ONLY_MSG,
      code: 'IMMUTABLE_EVENT_STORE',
      statusCode: 403,
      details: {
        attemptedMethod: method,
        path: req.originalUrl || req.path,
        reason: 'Event store is strictly append-only. Mutation and deletion of historical records are prohibited.'
      }
    });
  }
  next();
}

module.exports = immutabilityGuard;
