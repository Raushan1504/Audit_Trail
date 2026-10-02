const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ConcurrencyException,
  validateOptimisticLock,
  formatConflictResponse
} = require('../src/concurrency/optimisticConcurrency');
const { ConflictError, ValidationError } = require('../src/utils/errors');

test('Day 23: ConcurrencyException Domain Error Structure', async (t) => {
  await t.test('creates ConcurrencyException with rich conflict context', () => {
    const err = new ConcurrencyException('Custom conflict message', {
      shipmentId: 'SHIP-CONC-001',
      expectedVersion: 2,
      currentVersion: 3,
      modifiedBy: 'Operator Alice'
    });

    assert.equal(err.name, 'ConcurrencyException');
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, 'CONCURRENCY_CONFLICT');
    assert.equal(err.shipmentId, 'SHIP-CONC-001');
    assert.equal(err.expectedVersion, 2);
    assert.equal(err.currentVersion, 3);
    assert.equal(err.modifiedBy, 'Operator Alice');
    assert.ok(err.resolutionHint.includes('version 3'));
    assert.ok(err instanceof ConflictError);
  });

  await t.test('generates intuitive default message and resolution hints when message omitted', () => {
    const err = new ConcurrencyException(null, {
      shipmentId: 'SHIP-CONC-002',
      expectedVersion: 4,
      currentVersion: 5
    });

    assert.ok(err.message.includes('SHIP-CONC-002'));
    assert.ok(err.message.includes('expected version 4'));
    assert.ok(err.message.includes('current database version is 5'));
    assert.ok(err.resolutionHint.includes('Reload the latest shipment state (version 5)'));
    assert.equal(err.details.currentVersion, 5);
    assert.equal(err.details.expectedVersion, 4);
  });
});

test('Day 23: validateOptimisticLock Logic Guard', async (t) => {
  await t.test('accepts matching expectedVersion and currentVersion', () => {
    const result = validateOptimisticLock({
      currentVersion: 4,
      expectedVersion: 4,
      shipmentId: 'SHIP-CONC-003'
    });

    assert.equal(result, true);
  });

  await t.test('accepts string representation of integers', () => {
    const result = validateOptimisticLock({
      currentVersion: 5,
      expectedVersion: '5',
      shipmentId: 'SHIP-CONC-004'
    });

    assert.equal(result, true);
  });

  await t.test('throws ConcurrencyException when expectedVersion is stale', () => {
    assert.throws(
      () => {
        validateOptimisticLock({
          currentVersion: 3,
          expectedVersion: 2,
          shipmentId: 'SHIP-CONC-005',
          modifiedBy: 'Operator Bob'
        });
      },
      (err) => {
        assert.equal(err.name, 'ConcurrencyException');
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'CONCURRENCY_CONFLICT');
        assert.equal(err.expectedVersion, 2);
        assert.equal(err.currentVersion, 3);
        assert.equal(err.modifiedBy, 'Operator Bob');
        return true;
      }
    );
  });

  await t.test('throws ConcurrencyException when expectedVersion is ahead of database', () => {
    assert.throws(
      () => {
        validateOptimisticLock({
          currentVersion: 1,
          expectedVersion: 3,
          shipmentId: 'SHIP-CONC-006'
        });
      },
      (err) => {
        assert.equal(err.name, 'ConcurrencyException');
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  await t.test('throws ValidationError when expectedVersion is undefined or negative', () => {
    assert.throws(
      () => {
        validateOptimisticLock({
          currentVersion: 1,
          expectedVersion: undefined,
          shipmentId: 'SHIP-CONC-007'
        });
      },
      (err) => {
        assert.ok(err instanceof ValidationError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    assert.throws(
      () => {
        validateOptimisticLock({
          currentVersion: 1,
          expectedVersion: -1,
          shipmentId: 'SHIP-CONC-008'
        });
      },
      (err) => {
        assert.ok(err instanceof ValidationError);
        return true;
      }
    );
  });
});

test('Day 23: formatConflictResponse Helper', () => {
  const err = new ConcurrencyException('Stale update attempted', {
    shipmentId: 'SHIP-CONC-009',
    expectedVersion: 1,
    currentVersion: 2
  });

  const payload = formatConflictResponse(err);
  assert.equal(payload.success, false);
  assert.equal(payload.statusCode, 409);
  assert.equal(payload.code, 'CONCURRENCY_CONFLICT');
  assert.equal(payload.conflict.shipmentId, 'SHIP-CONC-009');
  assert.equal(payload.conflict.expectedVersion, 1);
  assert.equal(payload.conflict.currentVersion, 2);
  assert.ok(payload.conflict.resolutionHint);
});
