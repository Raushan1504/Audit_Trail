const test = require('node:test');
const assert = require('node:assert');

const {
  createInitialProjectionState
} = require('../src/domain/projectionState');

const {
  applyProjectionEvent
} = require('../src/domain/projectionReducer');

const {
  EVENT_TYPES
} = require('../src/events/eventTypes');

function createEvent(eventType, version, payload = {}) {
  return {
    aggregateId: 'SHIP-001',
    eventType,
    version,
    payload
  };
}

test('projection state contract', async (t) => {

  await t.test('should create a valid initial projection state', () => {
    const state = createInitialProjectionState('SHIP-001');

    assert.deepStrictEqual(state, {
      shipmentId: 'SHIP-001',
      location: null,
      status: 'CREATED',
      temperature: null,
      vessel: null,
      version: 0
    });
  });

  await t.test('should apply CONTAINER_CREATED event', () => {
    const state = createInitialProjectionState('SHIP-001');

    const nextState = applyProjectionEvent(
      state,
      createEvent(EVENT_TYPES.CONTAINER_CREATED, 1)
    );

    assert.strictEqual(nextState.shipmentId, 'SHIP-001');
    assert.strictEqual(nextState.status, 'CREATED');
    assert.strictEqual(nextState.version, 1);
  });

  await t.test('should apply LOADED_ON_SHIP event', () => {
    const state = createInitialProjectionState('SHIP-001');

    const nextState = applyProjectionEvent(
      state,
      createEvent(EVENT_TYPES.LOADED_ON_SHIP, 2, {
        port: 'Mumbai Port',
        vessel: 'MV-AUDIT-01'
      })
    );

    assert.strictEqual(nextState.status, 'LOADED');
    assert.strictEqual(nextState.location, 'Mumbai Port');
    assert.strictEqual(nextState.vessel, 'MV-AUDIT-01');
    assert.strictEqual(nextState.version, 2);
  });

  await t.test('should apply TEMPERATURE_SPIKE event', () => {
    const state = {
      ...createInitialProjectionState('SHIP-001'),
      status: 'LOADED',
      location: 'Mumbai Port',
      vessel: 'MV-AUDIT-01',
      version: 2
    };

    const nextState = applyProjectionEvent(
      state,
      createEvent(EVENT_TYPES.TEMPERATURE_SPIKE, 3, {
        temperature: 12
      })
    );

    assert.strictEqual(nextState.status, 'TEMPERATURE_SPIKE');
    assert.strictEqual(nextState.temperature, 12);
    assert.strictEqual(nextState.location, 'Mumbai Port');
    assert.strictEqual(nextState.vessel, 'MV-AUDIT-01');
    assert.strictEqual(nextState.version, 3);
  });

  await t.test('should apply ARRIVED_AT_PORT event', () => {
    const state = {
      ...createInitialProjectionState('SHIP-001'),
      status: 'TEMPERATURE_SPIKE',
      location: 'Mumbai Port',
      temperature: 12,
      vessel: 'MV-AUDIT-01',
      version: 3
    };

    const nextState = applyProjectionEvent(
      state,
      createEvent(EVENT_TYPES.ARRIVED_AT_PORT, 4, {
        port: 'Chennai Port'
      })
    );

    assert.strictEqual(nextState.status, 'ARRIVED');
    assert.strictEqual(nextState.location, 'Chennai Port');
    assert.strictEqual(nextState.temperature, 12);
    assert.strictEqual(nextState.vessel, 'MV-AUDIT-01');
    assert.strictEqual(nextState.version, 4);
  });

  await t.test('should reject missing projection state', () => {
    assert.throws(
      () => applyProjectionEvent(null, createEvent(
        EVENT_TYPES.CONTAINER_CREATED,
        1
      )),
      /projection state is required/
    );
  });

  await t.test('should reject missing event', () => {
    const state = createInitialProjectionState('SHIP-001');

    assert.throws(
      () => applyProjectionEvent(state, null),
      /event is required/
    );
  });

  await t.test('should reject unsupported event type', () => {
    const state = createInitialProjectionState('SHIP-001');

    assert.throws(
      () => applyProjectionEvent(state, {
        eventType: 'UNKNOWN_EVENT',
        version: 1
      }),
      /Unsupported event type/
    );
  });

  // Day 16: Pure projection updater tests

  await t.test('should not mutate the original projection state', () => {
    const state = {
      ...createInitialProjectionState('SHIP-001'),
      status: 'LOADED',
      location: 'Mumbai Port',
      vessel: 'MV-AUDIT-01',
      version: 2
    };

    const originalState = { ...state };

    const nextState = applyProjectionEvent(
      state,
      createEvent(EVENT_TYPES.TEMPERATURE_SPIKE, 3, {
        temperature: 12
      })
    );

    assert.deepStrictEqual(state, originalState);
    assert.notStrictEqual(nextState, state);
  });

  await t.test('should produce the same result for the same input', () => {
    const state = {
      ...createInitialProjectionState('SHIP-001'),
      status: 'LOADED',
      location: 'Mumbai Port',
      vessel: 'MV-AUDIT-01',
      version: 2
    };

    const event = createEvent(
      EVENT_TYPES.TEMPERATURE_SPIKE,
      3,
      {
        temperature: 12
      }
    );

    const firstResult = applyProjectionEvent(state, event);
    const secondResult = applyProjectionEvent(state, event);

    assert.deepStrictEqual(firstResult, secondResult);
  });

  await t.test('should preserve unrelated projection fields', () => {
    const state = {
      ...createInitialProjectionState('SHIP-001'),
      status: 'TEMPERATURE_SPIKE',
      location: 'Mumbai Port',
      temperature: 12,
      vessel: 'MV-AUDIT-01',
      version: 3
    };

    const nextState = applyProjectionEvent(
      state,
      createEvent(EVENT_TYPES.ARRIVED_AT_PORT, 4, {
        port: 'Chennai Port'
      })
    );

    assert.strictEqual(nextState.location, 'Chennai Port');
    assert.strictEqual(nextState.temperature, 12);
    assert.strictEqual(nextState.vessel, 'MV-AUDIT-01');
    assert.strictEqual(nextState.status, 'ARRIVED');
    assert.strictEqual(nextState.version, 4);

    assert.strictEqual(state.location, 'Mumbai Port');
    assert.strictEqual(state.temperature, 12);
    assert.strictEqual(state.vessel, 'MV-AUDIT-01');
    assert.strictEqual(state.version, 3);
  });

});