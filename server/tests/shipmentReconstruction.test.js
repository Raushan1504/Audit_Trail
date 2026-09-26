const test = require('node:test');
const assert = require('node:assert');

const {
  reconstructStateAsOf
} = require('../src/domain/shipmentReconstruction');

const {
  EVENT_TYPES
} = require('../src/events/eventTypes');

function createEvent(
  aggregateId,
  eventType,
  version,
  payload = {}
) {
  return {
    aggregateId,
    eventType,
    version,
    payload
  };
}

function createShipmentHistory() {
  const shipmentId = 'SHIP-001';

  const events = [
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

  return {
    shipmentId,
    events
  };
}

test('reconstructStateAsOf', async (t) => {
  await t.test(
    'should reconstruct shipment state at version 2',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      const state = reconstructStateAsOf(
        shipmentId,
        events,
        2
      );

      assert.strictEqual(
        state.shipmentId,
        shipmentId
      );
      assert.strictEqual(state.version, 2);
      assert.strictEqual(state.status, 'LOADED');
      assert.strictEqual(
        state.location,
        'Mumbai Port'
      );
      assert.strictEqual(
        state.vessel,
        'MV-AUDIT-01'
      );
      assert.strictEqual(
        state.temperature,
        null
      );
    }
  );

  await t.test(
    'should reconstruct shipment state at version 3',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      const state = reconstructStateAsOf(
        shipmentId,
        events,
        3
      );

      assert.strictEqual(state.version, 3);
      assert.strictEqual(
        state.status,
        'TEMPERATURE_SPIKE'
      );
      assert.strictEqual(
        state.temperature,
        12
      );
      assert.strictEqual(
        state.location,
        'Mumbai Port'
      );
      assert.strictEqual(
        state.vessel,
        'MV-AUDIT-01'
      );
    }
  );

  await t.test(
    'should reconstruct the latest state when target version is the final version',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      const state = reconstructStateAsOf(
        shipmentId,
        events,
        4
      );

      assert.strictEqual(state.version, 4);
      assert.strictEqual(
        state.status,
        'ARRIVED'
      );
      assert.strictEqual(
        state.location,
        'Chennai Port'
      );
      assert.strictEqual(
        state.temperature,
        12
      );
      assert.strictEqual(
        state.vessel,
        'MV-AUDIT-01'
      );
    }
  );

  await t.test(
    'should return initial state for target version 0',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      const state = reconstructStateAsOf(
        shipmentId,
        events,
        0
      );

      assert.strictEqual(
        state.shipmentId,
        shipmentId
      );
      assert.strictEqual(
        state.version,
        0
      );
      assert.strictEqual(
        state.status,
        'CREATED'
      );
      assert.strictEqual(
        state.location,
        null
      );
      assert.strictEqual(
        state.temperature,
        null
      );
    }
  );

  await t.test(
    'should reject a target version greater than available history',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      assert.throws(
        () =>
          reconstructStateAsOf(
            shipmentId,
            events,
            5
          ),
        /targetVersion 5 is not available/
      );
    }
  );

  await t.test(
    'should reject a negative target version',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      assert.throws(
        () =>
          reconstructStateAsOf(
            shipmentId,
            events,
            -1
          ),
        /targetVersion must be a non-negative integer/
      );
    }
  );

  await t.test(
    'should reject a non-integer target version',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      assert.throws(
        () =>
          reconstructStateAsOf(
            shipmentId,
            events,
            2.5
          ),
        /targetVersion must be a non-negative integer/
      );
    }
  );

  await t.test(
    'should reject a missing shipment id',
    () => {
      const { events } =
        createShipmentHistory();

      assert.throws(
        () =>
          reconstructStateAsOf(
            null,
            events,
            2
          ),
        /shipmentId is required/
      );
    }
  );

  await t.test(
    'should reject non-array events',
    () => {
      assert.throws(
        () =>
          reconstructStateAsOf(
            'SHIP-001',
            null,
            2
          ),
        /events must be an array/
      );
    }
  );
});
