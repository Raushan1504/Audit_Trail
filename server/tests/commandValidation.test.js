const test = require('node:test');
const assert = require('node:assert');
const {
  COMMAND_TYPES,
  validateCommand,
  validateStateTransition
} = require('../src/domain/commandValidation');

test('validateCommand', async (t) => {
  await t.test('should validate a valid CREATE_CONTAINER command', () => {
    const cmd = {
      shipmentId: 'ship-123',
      type: COMMAND_TYPES.CREATE_CONTAINER,
      origin: 'New York',
      destination: 'London'
    };
    assert.strictEqual(validateCommand(cmd), true);
  });

  await t.test('should fail if shipmentId is missing', () => {
    const cmd = {
      type: COMMAND_TYPES.CREATE_CONTAINER,
      origin: 'New York',
      destination: 'London'
    };
    assert.throws(() => validateCommand(cmd), /shipmentId is required/);
  });

  await t.test('should fail if type is missing or unsupported', () => {
    const cmd = {
      shipmentId: 'ship-123',
      type: 'INVALID_TYPE'
    };
    assert.throws(() => validateCommand(cmd), /Unsupported command type/);
  });

  await t.test('should fail if required payload fields are missing', () => {
    const cmd = {
      shipmentId: 'ship-123',
      type: COMMAND_TYPES.CREATE_CONTAINER
      // origin and destination missing
    };
    assert.throws(() => validateCommand(cmd), /origin is required/);
  });
});

test('validateStateTransition', async (t) => {
  await t.test('should allow CREATE_CONTAINER when version is 0', () => {
    const state = { status: 'CREATED', version: 0 };
    assert.strictEqual(validateStateTransition(state, COMMAND_TYPES.CREATE_CONTAINER), true);
  });

  await t.test('should deny other commands when version is 0', () => {
    const state = { status: 'CREATED', version: 0 };
    assert.throws(() => {
      validateStateTransition(state, COMMAND_TYPES.LOAD_ON_SHIP);
    }, /Shipment must be created first/);
  });

  await t.test('should deny CREATE_CONTAINER when version is > 0', () => {
    const state = { status: 'CREATED', version: 1 };
    assert.throws(() => {
      validateStateTransition(state, COMMAND_TYPES.CREATE_CONTAINER);
    }, /Shipment is already created/);
  });

  await t.test('should allow LOAD_ON_SHIP when status is CREATED and version > 0', () => {
    const state = { status: 'CREATED', version: 1 };
    assert.strictEqual(validateStateTransition(state, COMMAND_TYPES.LOAD_ON_SHIP), true);
  });

  await t.test('should allow ARRIVE_AT_PORT directly from LOADED (normal flow)', () => {
    const state = { status: 'LOADED', version: 2 };
    assert.strictEqual(validateStateTransition(state, COMMAND_TYPES.ARRIVE_AT_PORT), true);
  });

  await t.test('should allow RECORD_TEMPERATURE_SPIKE from LOADED', () => {
    const state = { status: 'LOADED', version: 2 };
    assert.strictEqual(validateStateTransition(state, COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE), true);
  });

  await t.test('should allow ARRIVE_AT_PORT from TEMPERATURE_SPIKE', () => {
    const state = { status: 'TEMPERATURE_SPIKE', version: 3 };
    assert.strictEqual(validateStateTransition(state, COMMAND_TYPES.ARRIVE_AT_PORT), true);
  });

  await t.test('should deny commands when status is ARRIVED (terminal state)', () => {
    const state = { status: 'ARRIVED', version: 4 };
    assert.throws(() => {
      validateStateTransition(state, COMMAND_TYPES.LOAD_ON_SHIP);
    }, /Invalid command LOAD_ON_SHIP for shipment status ARRIVED/);
  });
});
