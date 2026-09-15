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

  await t.test('should completely reconstruct shipment state from full event history', () => {
    const events = [
      createEvent('SHIP-001', EVENT_TYPES.CONTAINER_CREATED, 1),
      createEvent('SHIP-001', EVENT_TYPES.LOADED_ON_SHIP, 2, {
        port: 'Mumbai Port',
        vessel: 'MV-AUDIT-01'
      }),
      createEvent('SHIP-001', EVENT_TYPES.TEMPERATURE_SPIKE, 3, {
        temperature: 12
      }),
      createEvent('SHIP-001', EVENT_TYPES.ARRIVED_AT_PORT, 4, {
        port: 'Chennai Port'
      })
    ];

    const state = replayShipmentEvents('SHIP-001', events);

    assert.strictEqual(state.shipmentId, 'SHIP-001');
    assert.strictEqual(state.version, 4);
    assert.strictEqual(state.status, 'ARRIVED');
    assert.strictEqual(state.location, 'Chennai Port');
    assert.strictEqual(state.temperature, 12);
    assert.strictEqual(state.vessel, 'MV-AUDIT-01');
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
  await t.test('should complete reconstruction audit from historical event sequence', () => {
    const shipmentId = 'AUDIT-SHIP-001';

    const historicalEvents = [
      createEvent(
        shipmentId,
        EVENT_TYPES.CONTAINER_CREATED,
        1
      ),
      createEvent(
        shipmentId,
        EVENT_TYPES.LOADED_ON_SHIP,
        2,
        {
          port: 'Mumbai Port',
          vessel: 'MV-AUDIT-01'
        }
      ),
      createEvent(
        shipmentId,
        EVENT_TYPES.TEMPERATURE_SPIKE,
        3,
        {
          temperature: 12
        }
      ),
      createEvent(
        shipmentId,
        EVENT_TYPES.ARRIVED_AT_PORT,
        4,
        {
          port: 'Chennai Port'
        }
      )
    ];

    const reconstructedState = replayShipmentEvents(
      shipmentId,
      historicalEvents
    );

    assert.strictEqual(historicalEvents.length, 4);
    assert.strictEqual(historicalEvents[0].version, 1);
    assert.strictEqual(historicalEvents[1].version, 2);
    assert.strictEqual(historicalEvents[2].version, 3);
    assert.strictEqual(historicalEvents[3].version, 4);

    assert.strictEqual(reconstructedState.shipmentId, shipmentId);
    assert.strictEqual(reconstructedState.version, 4);
    assert.strictEqual(reconstructedState.status, 'ARRIVED');
    assert.strictEqual(reconstructedState.location, 'Chennai Port');
    assert.strictEqual(reconstructedState.temperature, 12);
    assert.strictEqual(reconstructedState.vessel, 'MV-AUDIT-01');
  });
});