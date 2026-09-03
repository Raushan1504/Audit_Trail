const { ValidationError } = require('../utils/errors');

/**
 * Request Validation Middleware Factory
 *
 * Provides a higher-order middleware to validate incoming request data
 * (body, params, query) against custom validator functions or schemas.
 *
 * @param {Function} validatorFn - Function receiving (req) and returning true or throwing/returning error details.
 * @returns {Function} Express middleware
 */
function validateRequest(validatorFn) {
  return (req, res, next) => {
    try {
      const result = validatorFn(req);
      if (result === false) {
        throw new ValidationError('Invalid request payload or parameters');
      }
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return next(error);
      }
      return next(new ValidationError(error.message));
    }
  };
}

module.exports = validateRequest;
