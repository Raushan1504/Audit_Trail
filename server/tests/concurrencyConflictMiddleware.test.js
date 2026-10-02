const test = require('node:test');
const assert = require('node:assert/strict');

const errorHandler = require('../src/middleware/errorHandler');
const { ConcurrencyException } = require('../src/concurrency/optimisticConcurrency');

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

test('Day 23: Express 409 Conflict Middleware Formatting', async (t) => {
  await t.test('formats ConcurrencyException with standardized 409 conflict payload', () => {
    const res = createMockRes();
    const req = {};
    const err = new ConcurrencyException('Conflict detected on shipment', {
      shipmentId: 'SHIP-409-TEST',
      expectedVersion: 1,
      currentVersion: 2,
      modifiedBy: 'Operator Carol',
      resolutionHint: 'Reload shipment SHIP-409-TEST at version 2.'
    });

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'CONCURRENCY_CONFLICT');
    assert.equal(res.body.statusCode, 409);
    assert.ok(res.body.conflict);
    assert.equal(res.body.conflict.shipmentId, 'SHIP-409-TEST');
    assert.equal(res.body.conflict.expectedVersion, 1);
    assert.equal(res.body.conflict.currentVersion, 2);
    assert.equal(res.body.conflict.modifiedBy, 'Operator Carol');
    assert.equal(res.body.conflict.resolutionHint, 'Reload shipment SHIP-409-TEST at version 2.');
  });

  await t.test('catches MongoDB E11000 aggregateId + version compound unique collision and maps to 409 CONCURRENCY_CONFLICT', () => {
    const res = createMockRes();
    const req = {};
    const err = new Error('E11000 duplicate key error collection: audit_trail.events index: aggregateId_1_version_1 dup key');
    err.code = 11000;
    err.keyPattern = { aggregateId: 1, version: 1 };
    err.keyValue = { aggregateId: 'SHIP-DUP-1', version: 3 };

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'CONCURRENCY_CONFLICT');
    assert.ok(res.body.conflict);
    assert.equal(res.body.conflict.shipmentId, 'SHIP-DUP-1');
    assert.equal(res.body.conflict.currentVersion, 3);
    assert.equal(res.body.conflict.expectedVersion, 2);
    assert.ok(res.body.conflict.resolutionHint);
  });
});
