const { ValidationError } = require('../utils/errors');

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
