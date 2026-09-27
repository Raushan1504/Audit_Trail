const test = require('node:test');
const assert = require('node:assert');
const ShipmentReadModel = require('../src/models/ShipmentReadModel');

test('ShipmentReadModel schema defines required CQRS indexes', () => {
  const indexes = ShipmentReadModel.schema.indexes();

  const hasShipmentIdUnique = indexes.some(
    ([fields, options]) => fields.shipmentId === 1 && options?.unique === true
  );
  const hasStatus = indexes.some(
    ([fields]) => fields.status === 1 && Object.keys(fields).length === 1
  );
  const hasCurrentLocation = indexes.some(
    ([fields]) => fields.currentLocation === 1 && Object.keys(fields).length === 1
  );
  const hasTemperature = indexes.some(
    ([fields]) => fields.temperature === 1 && Object.keys(fields).length === 1
  );
  const hasLastAppliedVersion = indexes.some(
    ([fields]) => fields.lastAppliedVersion === 1 && Object.keys(fields).length === 1
  );
  const hasCompoundStatusUpdatedAt = indexes.some(
    ([fields]) => fields.status === 1 && fields.updatedAt === -1
  );
  const hasCompoundShipmentVersion = indexes.some(
    ([fields]) => fields.shipmentId === 1 && fields.lastAppliedVersion === 1
  );

  assert.strictEqual(hasShipmentIdUnique, true, 'Should define unique index on { shipmentId: 1 }');
  assert.strictEqual(hasStatus, true, 'Should define index on { status: 1 } for operational filtering');
  assert.strictEqual(hasCurrentLocation, true, 'Should define index on { currentLocation: 1 }');
  assert.strictEqual(hasTemperature, true, 'Should define index on { temperature: 1 }');
  assert.strictEqual(hasLastAppliedVersion, true, 'Should define index on { lastAppliedVersion: 1 }');
  assert.strictEqual(hasCompoundStatusUpdatedAt, true, 'Should define compound index on { status: 1, updatedAt: -1 }');
  assert.strictEqual(hasCompoundShipmentVersion, true, 'Should define compound index on { shipmentId: 1, lastAppliedVersion: 1 }');
});

test('ShipmentReadModel schema options disable versionKey and enable timestamps', () => {
  assert.strictEqual(ShipmentReadModel.schema.options.versionKey, false, 'Mongoose versionKey (__v) should be disabled');
  assert.strictEqual(ShipmentReadModel.schema.options.timestamps, true, 'Timestamps (createdAt, updatedAt) should be enabled');
  assert.ok(ShipmentReadModel.schema.path('createdAt'), 'createdAt path should exist');
  assert.ok(ShipmentReadModel.schema.path('updatedAt'), 'updatedAt path should exist');
});

test('ShipmentReadModel schema path defaults and types', () => {
  const doc = new ShipmentReadModel({ shipmentId: 'SHP-001' });

  assert.strictEqual(doc.shipmentId, 'SHP-001');
  assert.strictEqual(doc.status, 'CREATED');
  assert.strictEqual(doc.currentLocation, null);
  assert.strictEqual(doc.temperature, null);
  assert.strictEqual(doc.lastAppliedVersion, 0);
  assert.strictEqual(doc.vessel, null);
  assert.strictEqual(doc.cargo, null);
  assert.strictEqual(doc.lastEventTimestamp, null);

  const docWithObjCargo = new ShipmentReadModel({
    shipmentId: 'SHP-002',
    cargo: { description: 'Dry Goods' }
  });
  assert.strictEqual(docWithObjCargo.cargo, 'Dry Goods');
});

test('ShipmentReadModel validates required fields and acceptable values', async () => {
  // Helper to validate and catch error
  const getValidationError = async (doc) => {
    try {
      await doc.validate();
      return null;
    } catch (err) {
      return err;
    }
  };

  // Missing shipmentId should fail
  const missingIdDoc = new ShipmentReadModel({});
  const missingIdError = await getValidationError(missingIdDoc);
  assert.ok(missingIdError?.errors?.shipmentId, 'Should require shipmentId');

  // Valid status values should pass
  const validStatuses = ['CREATED', 'LOADED', 'TEMPERATURE_SPIKE', 'ARRIVED'];
  for (const status of validStatuses) {
    const validDoc = new ShipmentReadModel({
      shipmentId: 'SHP-TEST',
      status,
      currentLocation: 'Port of Rotterdam',
      temperature: 4.5,
      lastAppliedVersion: 1
    });
    const error = await getValidationError(validDoc);
    assert.strictEqual(error, null, `Status "${status}" should be valid`);
  }

  // Invalid status value should fail
  const invalidStatusDoc = new ShipmentReadModel({
    shipmentId: 'SHP-TEST',
    status: 'INVALID_STATUS'
  });
  const invalidStatusError = await getValidationError(invalidStatusDoc);
  assert.ok(invalidStatusError?.errors?.status, 'Should reject invalid status enum');

  // Negative version should fail
  const negativeVersionDoc = new ShipmentReadModel({
    shipmentId: 'SHP-TEST',
    lastAppliedVersion: -1
  });
  const negativeVersionError = await getValidationError(negativeVersionDoc);
  assert.ok(negativeVersionError?.errors?.lastAppliedVersion, 'Should reject negative lastAppliedVersion');
});

test('ShipmentReadModel aliases provide bidirectional interoperability', () => {
  const doc = new ShipmentReadModel({
    aggregateId: 'SHP-ALIAS-1',
    location: 'Port of Singapore',
    version: 3
  });

  // Check that aliases populate underlying schema fields
  assert.strictEqual(doc.shipmentId, 'SHP-ALIAS-1');
  assert.strictEqual(doc.aggregateId, 'SHP-ALIAS-1');

  assert.strictEqual(doc.currentLocation, 'Port of Singapore');
  assert.strictEqual(doc.location, 'Port of Singapore');

  assert.strictEqual(doc.lastAppliedVersion, 3);
  assert.strictEqual(doc.version, 3);

  // Check mutation through aliases
  doc.location = 'Port of Shanghai';
  assert.strictEqual(doc.currentLocation, 'Port of Shanghai');

  doc.version = 4;
  assert.strictEqual(doc.lastAppliedVersion, 4);

  doc.aggregateId = 'SHP-ALIAS-2';
  assert.strictEqual(doc.shipmentId, 'SHP-ALIAS-2');
});
