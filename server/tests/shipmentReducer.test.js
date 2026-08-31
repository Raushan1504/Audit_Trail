const test = require('node:test');
const assert = require('node:assert');

const {
  replayShipmentEvents
} = require('../src/domain/shipmentReducer');

const {
  EVENT_TYPES
} = require('../src/events/eventTypes');

function createEvent(aggregateId, eventType, version, payload = {}) {
  return {
    aggregateId,
    eventType,
    version,
    payload
  };
}

test('replayShipmentEvents', async (t) => {

  await t.test('should replay events in correct version order', () => {
    const events = [
      createEvent('SHIP-001', EVENT_TYPES.CONTAINER_CREATED, 1),
      createEvent('SHIP-001', EVENT_TYPES.LOADED_ON_SHIP, 2, {
        port: 'Mumbai Port',
        vessel: 'MSC'
      }),
      createEvent('SHIP-001', EVENT_TYPES.TEMPERATURE_SPIKE, 3, {
        temperature: 12
      }),
      createEvent('SHIP-001', EVENT_TYPES.ARRIVED_AT_PORT, 4, {
        port: 'Chennai Port'
      })
    ];

    const state = replayShipmentEvents('SHIP-001', events);

    assert.strictEqual(state.version, 4);
    assert.strictEqual(state.status, 'ARRIVED');
    assert.strictEqual(state.location, 'Chennai Port');
    assert.strictEqual(state.temperature, 12);
  });

  await t.test('should reject skipped event versions', () => {
    const events = [
      createEvent('SHIP-001', EVENT_TYPES.CONTAINER_CREATED, 1),
      createEvent('SHIP-001', EVENT_TYPES.LOADED_ON_SHIP, 3)
    ];

    assert.throws(
      () => replayShipmentEvents('SHIP-001', events),
      /invalid event version/
    );
  });

  await t.test('should reject duplicate event versions', () => {
    const events = [
      createEvent('SHIP-001', EVENT_TYPES.CONTAINER_CREATED, 1),
      createEvent('SHIP-001', EVENT_TYPES.LOADED_ON_SHIP, 2),
      createEvent('SHIP-001', EVENT_TYPES.TEMPERATURE_SPIKE, 2)
    ];

    assert.throws(
      () => replayShipmentEvents('SHIP-001', events),
      /invalid event version/
    );
  });

  await t.test('should reject replay starting from version other than 1', () => {
    const events = [
      createEvent('SHIP-001', EVENT_TYPES.CONTAINER_CREATED, 2)
    ];

    assert.throws(
      () => replayShipmentEvents('SHIP-001', events),
      /invalid event version/
    );
  });

  await t.test('should reject event from another shipment', () => {
    const events = [
      createEvent('SHIP-001', EVENT_TYPES.CONTAINER_CREATED, 1),
      createEvent('SHIP-002', EVENT_TYPES.LOADED_ON_SHIP, 2)
    ];

    assert.throws(
      () => replayShipmentEvents('SHIP-001', events),
      /does not match shipmentId/
    );
  });
});