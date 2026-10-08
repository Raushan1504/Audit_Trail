const { NotFoundError } = require('../utils/errors');

function notFoundHandler(req, res, next) {
  const message = `Route ${req.method} ${req.originalUrl} not found`;
  next(new NotFoundError(message));
}

module.exports = notFoundHandler;
