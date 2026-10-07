const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createShipmentAggregate
} = require('../src/domain/shipmentAggregate');

test('creates a shipment aggregate with version 0', () => {
  const aggregate = createShipmentAggregate('SHIP-OCC-001');

  assert.equal(aggregate.state.shipmentId, 'SHIP-OCC-001');
  assert.equal(aggregate.state.version, 0);
});

test('accepts a matching expected version', () => {
  const aggregate = createShipmentAggregate('SHIP-OCC-002');

  assert.equal(aggregate.checkVersion(0), true);
});

test('rejects a stale expected version', () => {
  const aggregate = createShipmentAggregate('SHIP-OCC-003');
  aggregate.state.version = 3;

  assert.throws(
    () => aggregate.checkVersion(2),
    (error) => {
      assert.equal(error.name, 'ConcurrencyException');
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'CONCURRENCY_CONFLICT');
      assert.equal(error.details.shipmentId, 'SHIP-OCC-003');
      assert.equal(error.details.expectedVersion, 2);
      assert.equal(error.details.currentVersion, 3);
      assert.match(error.details.resolution, /Reload the latest shipment state/);
      return true;
    }
  );
});

test('rejects an expected version ahead of current version', () => {
  const aggregate = createShipmentAggregate('SHIP-OCC-004');
  aggregate.state.version = 3;

  assert.throws(
    () => aggregate.checkVersion(4),
    (error) => {
      assert.equal(error.name, 'ConcurrencyException');
      assert.equal(error.statusCode, 409);
      return true;
    }
  );
});

test('rejects a missing expected version', () => {
  const aggregate = createShipmentAggregate('SHIP-OCC-005');

  assert.throws(
    () => aggregate.checkVersion(undefined),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.equal(error.statusCode, 400);
      return true;
    }
  );
});

test('rejects a negative expected version', () => {
  const aggregate = createShipmentAggregate('SHIP-OCC-006');

  assert.throws(
    () => aggregate.checkVersion(-1),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      return true;
    }
  );
});

test('version check does not mutate aggregate state', () => {
  const aggregate = createShipmentAggregate('SHIP-OCC-007');
  aggregate.state.version = 5;

  aggregate.checkVersion(5);

  assert.equal(aggregate.state.version, 5);
});
