process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  InternalServerError,
  errorHandler,
  notFoundHandler,
  validateRequest,
} = require('../src/middleware');

test('Custom Error Classes', async (t) => {
  await t.test('AppError creates instance with default values', () => {
    const err = new AppError('Something went wrong');
    assert.strictEqual(err.message, 'Something went wrong');
    assert.strictEqual(err.statusCode, 500);
    assert.strictEqual(err.code, 'INTERNAL_SERVER_ERROR');
    assert.strictEqual(err.isOperational, true);
    assert.strictEqual(err.details, null);
  });

  await t.test('ValidationError defaults to 400 and VALIDATION_ERROR code', () => {
    const err = new ValidationError('Invalid input', [{ field: 'shipmentId', message: 'Required' }]);
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.code, 'VALIDATION_ERROR');
    assert.strictEqual(err.message, 'Invalid input');
    assert.deepStrictEqual(err.details, [{ field: 'shipmentId', message: 'Required' }]);
  });

  await t.test('NotFoundError defaults to 404 and NOT_FOUND code', () => {
    const err = new NotFoundError('Shipment not found');
    assert.strictEqual(err.statusCode, 404);
    assert.strictEqual(err.code, 'NOT_FOUND');
    assert.strictEqual(err.message, 'Shipment not found');
  });

  await t.test('ConflictError defaults to 409 and CONFLICT code', () => {
    const err = new ConflictError('Shipment already exists');
    assert.strictEqual(err.statusCode, 409);
    assert.strictEqual(err.code, 'CONFLICT');
    assert.strictEqual(err.message, 'Shipment already exists');
  });

  await t.test('BadRequestError defaults to 400 and BAD_REQUEST code', () => {
    const err = new BadRequestError('Bad payload');
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.code, 'BAD_REQUEST');
  });

  await t.test('InternalServerError defaults to 500 and INTERNAL_SERVER_ERROR code', () => {
    const err = new InternalServerError('Unexpected crash');
    assert.strictEqual(err.statusCode, 500);
    assert.strictEqual(err.code, 'INTERNAL_SERVER_ERROR');
  });
});

test('errorHandler Middleware', async (t) => {
  const createMockRes = () => {
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    return res;
  };

  await t.test('formats custom ValidationError properly', () => {
    const res = createMockRes();
    const err = new ValidationError('Field shipmentId is required', [{ field: 'shipmentId' }]);

    errorHandler(err, {}, res, () => {});

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Field shipmentId is required');
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
    assert.deepStrictEqual(res.body.details, [{ field: 'shipmentId' }]);
  });

  await t.test('formats custom NotFoundError properly', () => {
    const res = createMockRes();
    const err = new NotFoundError('Shipment SHIP-999 not found');

    errorHandler(err, {}, res, () => {});

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Shipment SHIP-999 not found');
    assert.strictEqual(res.body.code, 'NOT_FOUND');
  });

  await t.test('formats generic error with status code', () => {
    const res = createMockRes();
    const err = new Error('Shipment with ID SHIP-1 already exists');
    err.status = 409;

    errorHandler(err, {}, res, () => {});

    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Shipment with ID SHIP-1 already exists');
    assert.strictEqual(res.body.code, 'BAD_REQUEST');
  });

  await t.test('handles JSON SyntaxError (malformed payload)', () => {
    const res = createMockRes();
    const err = new SyntaxError('Unexpected token in JSON');
    err.status = 400;
    err.body = '{"invalid": ';

    errorHandler(err, {}, res, () => {});

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'INVALID_JSON');
    assert.strictEqual(res.body.error, 'Malformed JSON in request payload');
  });

  await t.test('handles Mongoose ValidationError', () => {
    const res = createMockRes();
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    err.errors = {
      aggregateId: { message: 'aggregateId is required' },
      version: { message: 'version must be positive integer' },
    };

    errorHandler(err, {}, res, () => {});

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
    assert.strictEqual(res.body.details.length, 2);
    assert.strictEqual(res.body.details[0].field, 'aggregateId');
  });

  await t.test('handles unhandled 500 error gracefully', () => {
    const res = createMockRes();
    const err = new Error('Database connection dropped unexpectedly');

    errorHandler(err, {}, res, () => {});

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'INTERNAL_SERVER_ERROR');
  });
});

test('notFoundHandler Middleware', async (t) => {
  await t.test('forwards NotFoundError to next()', () => {
    const req = { method: 'GET', originalUrl: '/api/unknown-endpoint' };
    let passedError = null;
    const next = (err) => {
      passedError = err;
    };

    notFoundHandler(req, {}, next);

    assert.ok(passedError instanceof NotFoundError);
    assert.strictEqual(passedError.statusCode, 404);
    assert.strictEqual(passedError.message, 'Route GET /api/unknown-endpoint not found');
  });
});

test('validateRequest Middleware', async (t) => {
  await t.test('calls next() when validation succeeds', () => {
    const middleware = validateRequest((req) => {
      return Boolean(req.body?.shipmentId);
    });

    let nextCalled = false;
    middleware({ body: { shipmentId: 'SHIP-123' } }, {}, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
  });

  await t.test('forwards ValidationError when validation fails', () => {
    const middleware = validateRequest((req) => {
      if (!req.body?.shipmentId) {
        throw new Error('shipmentId is required');
      }
    });

    let caughtError = null;
    middleware({ body: {} }, {}, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof ValidationError);
    assert.strictEqual(caughtError.statusCode, 400);
    assert.strictEqual(caughtError.message, 'shipmentId is required');
  });
});
