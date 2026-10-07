const errorHandler = require('./errorHandler');
const notFoundHandler = require('./notFoundHandler');
const validateRequest = require('./validateRequest');
const immutabilityGuard = require('./immutabilityGuard');
const {
  AppError,
  ValidationError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} = require('../utils/errors');

const { createRateLimiter } = require('./rateLimiter');
const { cacheControlMiddleware } = require('./cacheControl');
const { securityHeadersMiddleware } = require('./securityHeaders');

module.exports = {
  errorHandler,
  notFoundHandler,
  validateRequest,
  immutabilityGuard,
  createRateLimiter,
  cacheControlMiddleware,
  securityHeadersMiddleware,
  AppError,
  ValidationError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  InternalServerError,
};