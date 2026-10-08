const test = require('node:test');
const assert = require('node:assert');

const {
  reconstructShipmentState,
  reconstructStateAsOf,
  reconstructStateAsOfTimestamp
} = require('../src/domain/shipmentReconstruction');

const {
  EVENT_TYPES
} = require('../src/events/eventTypes');

function createEvent(
  aggregateId,
  eventType,
  version,
  timestamp,
  payload = {}
) {
  return {
    aggregateId,
    eventType,
    version,
    timestamp,
    payload
  };
}

function createShipmentHistory() {
  const shipmentId = 'SHIP-001';

  const events = [
    createEvent(
      shipmentId,
      EVENT_TYPES.CONTAINER_CREATED,
      1,
      '2026-08-01T10:00:00.000Z'
    ),
    createEvent(
      shipmentId,
      EVENT_TYPES.LOADED_ON_SHIP,
      2,
      '2026-08-01T12:00:00.000Z',
      {
        port: 'Mumbai Port',
        vessel: 'MV-AUDIT-01'
      }
    ),
    createEvent(
      shipmentId,
      EVENT_TYPES.TEMPERATURE_SPIKE,
      3,
      '2026-08-01T15:00:00.000Z',
      {
        temperature: 12
      }
    ),
    createEvent(
      shipmentId,
      EVENT_TYPES.ARRIVED_AT_PORT,
      4,
      '2026-08-01T18:00:00.000Z',
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

test('reconstructStateAsOfTimestamp', async (t) => {
  await t.test(
    'should reconstruct state using events before the target timestamp',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      const state = reconstructStateAsOfTimestamp(
        shipmentId,
        events,
        '2026-08-01T14:00:00.000Z'
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
    'should include an event exactly at the target timestamp',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      const state = reconstructStateAsOfTimestamp(
        shipmentId,
        events,
        '2026-08-01T15:00:00.000Z'
      );

      assert.strictEqual(state.version, 3);
      assert.strictEqual(
        state.status,
        'TEMPERATURE_SPIKE'
      );
      assert.strictEqual(state.temperature, 12);
    }
  );

  await t.test(
    'should return the initial state before the first event',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      const state = reconstructStateAsOfTimestamp(
        shipmentId,
        events,
        '2026-08-01T09:00:00.000Z'
      );

      assert.strictEqual(
        state.shipmentId,
        shipmentId
      );
      assert.strictEqual(state.version, 0);
      assert.strictEqual(state.status, 'CREATED');
      assert.strictEqual(state.location, null);
      assert.strictEqual(state.temperature, null);
    }
  );

  await t.test(
    'should return the latest state after the event history',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      const state = reconstructStateAsOfTimestamp(
        shipmentId,
        events,
        '2026-08-01T20:00:00.000Z'
      );

      assert.strictEqual(state.version, 4);
      assert.strictEqual(state.status, 'ARRIVED');
      assert.strictEqual(
        state.location,
        'Chennai Port'
      );
      assert.strictEqual(state.temperature, 12);
      assert.strictEqual(
        state.vessel,
        'MV-AUDIT-01'
      );
    }
  );

  await t.test(
    'should reject an invalid target timestamp',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      assert.throws(
        () =>
          reconstructStateAsOfTimestamp(
            shipmentId,
            events,
            'not-a-timestamp'
          ),
        /targetTimestamp must be a valid ISO timestamp/
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
          reconstructStateAsOfTimestamp(
            null,
            events,
            '2026-08-01T14:00:00.000Z'
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
          reconstructStateAsOfTimestamp(
            'SHIP-001',
            null,
            '2026-08-01T14:00:00.000Z'
          ),
        /events must be an array/
      );
    }
  );

  await t.test(
    'should reject an event with an invalid timestamp',
    () => {
      const { shipmentId, events } =
        createShipmentHistory();

      events[2].timestamp = 'invalid-date';

      assert.throws(
        () =>
          reconstructStateAsOfTimestamp(
            shipmentId,
            events,
            '2026-08-01T16:00:00.000Z'
          ),
        /invalid event timestamp for version 3/
      );
    }
  );
});
test('temporal replay with 100+ sequential logistics events', () => {
  const shipmentId = 'SHIP-STRESS-001';
  const events = [];

  const startTime = Date.parse('2026-08-01T10:00:00.000Z');

  events.push(
    createEvent(
      shipmentId,
      EVENT_TYPES.CONTAINER_CREATED,
      1,
      new Date(startTime).toISOString()
    )
  );

  events.push(
    createEvent(
      shipmentId,
      EVENT_TYPES.LOADED_ON_SHIP,
      2,
      new Date(startTime + 60_000).toISOString(),
      {
        port: 'Mumbai Port',
        vessel: 'MV-AUDIT-01'
      }
    )
  );

  for (let version = 3; version <= 119; version++) {
    events.push(
      createEvent(
        shipmentId,
        EVENT_TYPES.TEMPERATURE_SPIKE,
        version,
        new Date(
          startTime + (version - 1) * 60_000
        ).toISOString(),
        {
          temperature: 8 + (version % 5)
        }
      )
    );
  }

  events.push(
    createEvent(
      shipmentId,
      EVENT_TYPES.ARRIVED_AT_PORT,
      120,
      new Date(
        startTime + 119 * 60_000
      ).toISOString(),
      {
        port: 'Chennai Port'
      }
    )
  );

  assert.strictEqual(events.length, 120);

  const heapBefore = process.memoryUsage().heapUsed;
  const start = process.hrtime.bigint();

  const finalState = reconstructShipmentState(
    shipmentId,
    events
  );

  const durationMs =
    Number(process.hrtime.bigint() - start) / 1_000_000;

  const heapAfter = process.memoryUsage().heapUsed;
  const heapDeltaKb =
    (heapAfter - heapBefore) / 1024;

  assert.strictEqual(finalState.shipmentId, shipmentId);
  assert.strictEqual(finalState.version, 120);
  assert.strictEqual(finalState.status, 'ARRIVED');
  assert.strictEqual(
    finalState.location,
    'Chennai Port'
  );
  assert.strictEqual(
    finalState.vessel,
    'MV-AUDIT-01'
  );

  assert.strictEqual(
    finalState.temperature,
    8 + (119 % 5)
  );

  const historicalState = reconstructStateAsOf(
    shipmentId,
    events,
    60
  );

  assert.strictEqual(
    historicalState.version,
    60
  );

  assert.strictEqual(
    historicalState.status,
    'TEMPERATURE_SPIKE'
  );

  assert.strictEqual(
    historicalState.location,
    'Mumbai Port'
  );

  assert.strictEqual(
    historicalState.vessel,
    'MV-AUDIT-01'
  );

  assert.strictEqual(
    historicalState.temperature,
    8 + (60 % 5)
  );

  const timestampState =
    reconstructStateAsOfTimestamp(
      shipmentId,
      events,
      new Date(
        startTime + 59 * 60_000
      ).toISOString()
    );

  assert.strictEqual(
    timestampState.version,
    60
  );

  assert.strictEqual(
    timestampState.status,
    'TEMPERATURE_SPIKE'
  );

  console.log(
    `\n[Day 20] Replayed ${events.length} events`
  );

  console.log(
    `[Day 20] Replay time: ${durationMs.toFixed(3)} ms`
  );

  console.log(
    `[Day 20] Heap delta: ${heapDeltaKb.toFixed(2)} KB`
  );
});