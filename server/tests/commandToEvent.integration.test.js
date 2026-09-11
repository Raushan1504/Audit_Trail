/**
 * ════════════════════════════════════════════════════════════════════════
 * Day 13 – Integration Test: Command → Domain → Event → MongoDB
 * ════════════════════════════════════════════════════════════════════════
 *
 * Validates the complete end-to-end workflow:
 *   1. Command is received and validated (commandService)
 *   2. Domain rules are enforced (commandValidation — state transitions)
 *   3. Domain event is created (createDomainEvent)
 *   4. Event is persisted to MongoDB via the event store (persistDomainEvent → eventStore)
 *   5. Persisted events can be retrieved and replayed to reconstruct state
 *
 * Uses an in-memory store that stubs Event.prototype.save and Event.find
 * to avoid requiring a live MongoDB connection while still exercising the
 * full code path through every layer.
 */

const test = require('node:test');
const assert = require('node:assert');

const Event = require('../src/models/Event');
const {
  handleCreateShipment,
  handleLoadShipment,
  handleTemperatureSpike,
  handleArriveAtPort
} = require('../src/commands/commandService');
const { getEventsByAggregateId } = require('../src/events/eventStore');
const { EVENT_TYPES } = require('../src/events/eventTypes');
const { reconstructShipmentState } = require('../src/domain/shipmentReconstruction');

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Creates an in-memory store and patches Mongoose's save / find so the
 * entire Command → Event → Persistence pipeline runs without a real DB.
 * Returns a teardown function to restore originals.
 */
function createInMemoryStore() {
  const store = [];
  const originalSave = Event.prototype.save;
  const originalFind = Event.find;

  Event.prototype.save = async function () {
    const doc = {
      _id: `mock-id-${store.length + 1}`,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      payload: this.payload,
      timestamp: this.timestamp,
      version: this.version
    };
    store.push(doc);
    return doc;
  };

  Event.find = function (query) {
    const filtered = store.filter((e) => e.aggregateId === query.aggregateId);
    return {
      sort(criteria) {
        if (criteria && criteria.version === 1) {
          filtered.sort((a, b) => a.version - b.version);
        }
        return Promise.resolve(filtered);
      }
    };
  };

  return {
    store,
    teardown() {
      Event.prototype.save = originalSave;
      Event.find = originalFind;
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Full lifecycle: Create → Load → TempSpike → Arrive
// ═══════════════════════════════════════════════════════════════════════

test('Integration: full shipment lifecycle Command → Domain → Event → MongoDB', async (t) => {
  const { store, teardown } = createInMemoryStore();
  const SHIPMENT_ID = 'INTG-LIFECYCLE-001';

  try {
    // ── Step 1: CreateShipment command ────────────────────────────────
    await t.test('CreateShipment command produces CONTAINER_CREATED event persisted to store', async () => {
      const result = await handleCreateShipment({
        shipmentId: SHIPMENT_ID,
        origin: 'Shanghai',
        destination: 'Rotterdam',
        cargo: 'Electronics'
      });

      assert.strictEqual(result.aggregateId, SHIPMENT_ID);
      assert.strictEqual(result.eventType, EVENT_TYPES.CONTAINER_CREATED);
      assert.strictEqual(result.version, 1);

      // Verify persistence
      assert.strictEqual(store.length, 1);
      assert.strictEqual(store[0].aggregateId, SHIPMENT_ID);
      assert.strictEqual(store[0].eventType, EVENT_TYPES.CONTAINER_CREATED);
      assert.deepStrictEqual(store[0].payload, {
        origin: 'Shanghai',
        destination: 'Rotterdam',
        cargo: 'Electronics'
      });
      assert.strictEqual(store[0].version, 1);
      assert.ok(store[0].timestamp instanceof Date, 'timestamp must be a Date instance');
    });

    // ── Step 2: LoadShipment command ─────────────────────────────────
    await t.test('LoadShipment command produces LOADED_ON_SHIP event at version 2', async () => {
      const result = await handleLoadShipment({
        shipmentId: SHIPMENT_ID,
        vessel: 'MV Pacific Runner',
        port: 'Shanghai Port'
      });

      assert.strictEqual(result.aggregateId, SHIPMENT_ID);
      assert.strictEqual(result.eventType, EVENT_TYPES.LOADED_ON_SHIP);
      assert.strictEqual(result.version, 2);

      // Verify persistence
      assert.strictEqual(store.length, 2);
      assert.strictEqual(store[1].payload.vessel, 'MV Pacific Runner');
      assert.strictEqual(store[1].payload.port, 'Shanghai Port');
    });

    // ── Step 3: TemperatureSpike command ─────────────────────────────
    await t.test('TemperatureSpike command produces TEMPERATURE_SPIKE event at version 3', async () => {
      const result = await handleTemperatureSpike({
        shipmentId: SHIPMENT_ID,
        temperature: 34.5,
        threshold: 25.0,
        sensorId: 'SENSOR-A7'
      });

      assert.strictEqual(result.aggregateId, SHIPMENT_ID);
      assert.strictEqual(result.eventType, EVENT_TYPES.TEMPERATURE_SPIKE);
      assert.strictEqual(result.version, 3);

      assert.strictEqual(store.length, 3);
      assert.strictEqual(store[2].payload.temperature, 34.5);
      assert.strictEqual(store[2].payload.threshold, 25.0);
      assert.strictEqual(store[2].payload.sensorId, 'SENSOR-A7');
    });

    // ── Step 4: ArriveAtPort command ─────────────────────────────────
    await t.test('ArriveAtPort command produces ARRIVED_AT_PORT event at version 4', async () => {
      const result = await handleArriveAtPort({
        shipmentId: SHIPMENT_ID,
        port: 'Port of Rotterdam'
      });

      assert.strictEqual(result.aggregateId, SHIPMENT_ID);
      assert.strictEqual(result.eventType, EVENT_TYPES.ARRIVED_AT_PORT);
      assert.strictEqual(result.version, 4);

      assert.strictEqual(store.length, 4);
      assert.strictEqual(store[3].payload.port, 'Port of Rotterdam');
    });

    // ── Step 5: Retrieve all events and verify order ─────────────────
    await t.test('all 4 events are retrievable and in sequential version order', async () => {
      const events = await getEventsByAggregateId(SHIPMENT_ID);

      assert.strictEqual(events.length, 4);
      assert.deepStrictEqual(
        events.map((e) => ({ version: e.version, eventType: e.eventType })),
        [
          { version: 1, eventType: EVENT_TYPES.CONTAINER_CREATED },
          { version: 2, eventType: EVENT_TYPES.LOADED_ON_SHIP },
          { version: 3, eventType: EVENT_TYPES.TEMPERATURE_SPIKE },
          { version: 4, eventType: EVENT_TYPES.ARRIVED_AT_PORT }
        ]
      );
    });

    // ── Step 6: Reconstruct state from persisted events ──────────────
    await t.test('reconstructed state reflects the full event history', async () => {
      const events = await getEventsByAggregateId(SHIPMENT_ID);
      const state = reconstructShipmentState(SHIPMENT_ID, events);

      assert.strictEqual(state.shipmentId, SHIPMENT_ID);
      assert.strictEqual(state.status, 'ARRIVED');
      assert.strictEqual(state.version, 4);
      assert.strictEqual(state.location, 'Port of Rotterdam');
    });
  } finally {
    teardown();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Domain validation rejects invalid state transitions
// ═══════════════════════════════════════════════════════════════════════

test('Integration: domain rejects invalid state transitions through command handlers', async (t) => {
  const { store, teardown } = createInMemoryStore();
  const SHIPMENT_ID = 'INTG-INVALID-TRANS-001';

  try {
    // Bootstrap: create the shipment first
    await handleCreateShipment({
      shipmentId: SHIPMENT_ID,
      origin: 'Mumbai',
      destination: 'Dubai',
      cargo: 'Textiles'
    });

    await t.test('rejects duplicate CreateShipment (409 conflict)', async () => {
      await assert.rejects(
        () => handleCreateShipment({
          shipmentId: SHIPMENT_ID,
          origin: 'Mumbai',
          destination: 'Dubai',
          cargo: 'Textiles'
        }),
        (err) => {
          assert.strictEqual(err.status, 409);
          assert.match(err.message, /already exists/);
          return true;
        }
      );
      // Store should still have only 1 event (the original create)
      assert.strictEqual(store.length, 1);
    });

    await t.test('rejects ArriveAtPort before LoadShipment (invalid transition from CREATED)', async () => {
      await assert.rejects(
        () => handleArriveAtPort({ shipmentId: SHIPMENT_ID, port: 'Dubai Port' }),
        (err) => {
          assert.match(err.message, /Invalid command/);
          return true;
        }
      );
      assert.strictEqual(store.length, 1, 'no event should be persisted on failed transition');
    });

    await t.test('rejects TemperatureSpike before LoadShipment (invalid transition from CREATED)', async () => {
      await assert.rejects(
        () => handleTemperatureSpike({
          shipmentId: SHIPMENT_ID,
          temperature: 40,
          threshold: 25,
          sensorId: 'S-1'
        }),
        (err) => {
          assert.match(err.message, /Invalid command/);
          return true;
        }
      );
      assert.strictEqual(store.length, 1);
    });
  } finally {
    teardown();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Command validation rejects malformed input before touching the store
// ═══════════════════════════════════════════════════════════════════════

test('Integration: command validation prevents malformed commands from reaching the store', async (t) => {
  const { store, teardown } = createInMemoryStore();

  try {
    await t.test('rejects CreateShipment without required origin field', async () => {
      await assert.rejects(
        () => handleCreateShipment({
          shipmentId: 'INTG-BAD-001',
          destination: 'Hamburg',
          cargo: 'Steel'
          // origin is missing
        }),
        (err) => {
          assert.match(err.message, /origin is required/);
          return true;
        }
      );
      assert.strictEqual(store.length, 0, 'no event should be persisted for invalid command');
    });

    await t.test('rejects CreateShipment without shipmentId', async () => {
      await assert.rejects(
        () => handleCreateShipment({
          origin: 'Shanghai',
          destination: 'Hamburg',
          cargo: 'Steel'
        }),
        (err) => {
          assert.match(err.message, /shipmentId is required/);
          return true;
        }
      );
      assert.strictEqual(store.length, 0);
    });

    await t.test('rejects LoadShipment without vessel field', async () => {
      // First create a valid shipment
      await handleCreateShipment({
        shipmentId: 'INTG-BAD-002',
        origin: 'Tokyo',
        destination: 'LA',
        cargo: 'Cars'
      });
      const countAfterCreate = store.length;

      await assert.rejects(
        () => handleLoadShipment({
          shipmentId: 'INTG-BAD-002',
          port: 'Tokyo Port'
          // vessel is missing
        }),
        (err) => {
          assert.match(err.message, /vessel is required/);
          return true;
        }
      );
      assert.strictEqual(store.length, countAfterCreate, 'store must not grow on validation failure');
    });

    await t.test('rejects TemperatureSpike without temperature field', async () => {
      // Load the shipment first so it's in the right state
      await handleLoadShipment({
        shipmentId: 'INTG-BAD-002',
        vessel: 'MV Test',
        port: 'Tokyo Port'
      });
      const countAfterLoad = store.length;

      await assert.rejects(
        () => handleTemperatureSpike({
          shipmentId: 'INTG-BAD-002',
          threshold: 25,
          sensorId: 'S-1'
          // temperature is missing
        }),
        (err) => {
          assert.match(err.message, /temperature is required/);
          return true;
        }
      );
      assert.strictEqual(store.length, countAfterLoad);
    });

    await t.test('rejects ArriveAtPort without port field', async () => {
      const countBefore = store.length;

      await assert.rejects(
        () => handleArriveAtPort({
          shipmentId: 'INTG-BAD-002'
          // port is missing
        }),
        (err) => {
          assert.match(err.message, /port is required/);
          return true;
        }
      );
      assert.strictEqual(store.length, countBefore);
    });
  } finally {
    teardown();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Command on non-existent shipment returns 404
// ═══════════════════════════════════════════════════════════════════════

test('Integration: commands on non-existent shipment return 404', async (t) => {
  const { store, teardown } = createInMemoryStore();

  try {
    await t.test('LoadShipment on missing shipment throws 404', async () => {
      await assert.rejects(
        () => handleLoadShipment({
          shipmentId: 'GHOST-SHIP-001',
          vessel: 'Phantom',
          port: 'Nowhere'
        }),
        (err) => {
          assert.strictEqual(err.status, 404);
          assert.match(err.message, /not found/);
          return true;
        }
      );
    });

    await t.test('TemperatureSpike on missing shipment throws 404', async () => {
      await assert.rejects(
        () => handleTemperatureSpike({
          shipmentId: 'GHOST-SHIP-002',
          temperature: 50,
          threshold: 25,
          sensorId: 'S-X'
        }),
        (err) => {
          assert.strictEqual(err.status, 404);
          return true;
        }
      );
    });

    await t.test('ArriveAtPort on missing shipment throws 404', async () => {
      await assert.rejects(
        () => handleArriveAtPort({
          shipmentId: 'GHOST-SHIP-003',
          port: 'Bermuda'
        }),
        (err) => {
          assert.strictEqual(err.status, 404);
          return true;
        }
      );
    });

    assert.strictEqual(store.length, 0, 'no events should be persisted for non-existent shipments');
  } finally {
    teardown();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Multi-aggregate isolation: events from one shipment don't leak
// ═══════════════════════════════════════════════════════════════════════

test('Integration: events from separate shipments are isolated in the store', async () => {
  const { store, teardown } = createInMemoryStore();

  try {
    // Create two independent shipments
    await handleCreateShipment({
      shipmentId: 'INTG-ISO-A',
      origin: 'Hamburg',
      destination: 'New York',
      cargo: 'Machinery'
    });

    await handleCreateShipment({
      shipmentId: 'INTG-ISO-B',
      origin: 'Tokyo',
      destination: 'Sydney',
      cargo: 'Automobiles'
    });

    // Progress shipment A further
    await handleLoadShipment({
      shipmentId: 'INTG-ISO-A',
      vessel: 'MV Atlantic',
      port: 'Hamburg Port'
    });

    assert.strictEqual(store.length, 3, 'total store should have 3 events across both aggregates');

    // Query each aggregate independently
    const eventsA = await getEventsByAggregateId('INTG-ISO-A');
    const eventsB = await getEventsByAggregateId('INTG-ISO-B');

    assert.strictEqual(eventsA.length, 2, 'shipment A should have 2 events');
    assert.strictEqual(eventsB.length, 1, 'shipment B should have 1 event');

    // Verify no cross-contamination
    assert.ok(
      eventsA.every((e) => e.aggregateId === 'INTG-ISO-A'),
      'all events for A must belong to A'
    );
    assert.ok(
      eventsB.every((e) => e.aggregateId === 'INTG-ISO-B'),
      'all events for B must belong to B'
    );

    // Reconstruct each aggregate independently
    const stateA = reconstructShipmentState('INTG-ISO-A', eventsA);
    const stateB = reconstructShipmentState('INTG-ISO-B', eventsB);

    assert.strictEqual(stateA.status, 'LOADED');
    assert.strictEqual(stateA.version, 2);
    assert.strictEqual(stateB.status, 'CREATED');
    assert.strictEqual(stateB.version, 1);
  } finally {
    teardown();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Event metadata integrity
// ═══════════════════════════════════════════════════════════════════════

test('Integration: persisted events contain correct metadata (timestamp, version, type)', async () => {
  const { store, teardown } = createInMemoryStore();
  const SHIPMENT_ID = 'INTG-META-001';

  try {
    const beforeCreate = new Date();
    await handleCreateShipment({
      shipmentId: SHIPMENT_ID,
      origin: 'Singapore',
      destination: 'London',
      cargo: 'Pharmaceuticals'
    });
    const afterCreate = new Date();

    const event = store[0];

    // Verify all required fields are present
    assert.ok(event._id, 'persisted event must have an _id');
    assert.strictEqual(event.aggregateId, SHIPMENT_ID);
    assert.strictEqual(event.eventType, EVENT_TYPES.CONTAINER_CREATED);
    assert.strictEqual(event.version, 1);
    assert.ok(event.timestamp instanceof Date, 'timestamp must be a Date');

    // Timestamp should be between before and after the call
    assert.ok(
      event.timestamp >= beforeCreate && event.timestamp <= afterCreate,
      'event timestamp must be within the execution window'
    );

    // Payload should contain only the command-specific data
    assert.strictEqual(event.payload.origin, 'Singapore');
    assert.strictEqual(event.payload.destination, 'London');
    assert.strictEqual(event.payload.cargo, 'Pharmaceuticals');
    assert.strictEqual(Object.keys(event.payload).length, 3, 'payload should have exactly 3 keys');
  } finally {
    teardown();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Terminal state enforcement (ARRIVED cannot accept more commands)
// ═══════════════════════════════════════════════════════════════════════

test('Integration: ARRIVED state is terminal — no further commands accepted', async () => {
  const { store, teardown } = createInMemoryStore();
  const SHIPMENT_ID = 'INTG-TERMINAL-001';

  try {
    // Drive the shipment to ARRIVED state
    await handleCreateShipment({
      shipmentId: SHIPMENT_ID,
      origin: 'Busan',
      destination: 'Vancouver',
      cargo: 'Consumer Goods'
    });
    await handleLoadShipment({
      shipmentId: SHIPMENT_ID,
      vessel: 'MV Pacific Star',
      port: 'Busan Port'
    });
    await handleArriveAtPort({
      shipmentId: SHIPMENT_ID,
      port: 'Port of Vancouver'
    });

    const countAtArrival = store.length;
    assert.strictEqual(countAtArrival, 3);

    // Attempt to load again after arrival
    await assert.rejects(
      () => handleLoadShipment({
        shipmentId: SHIPMENT_ID,
        vessel: 'MV Another',
        port: 'Vancouver'
      }),
      (err) => {
        assert.match(err.message, /Invalid command/);
        return true;
      }
    );

    // Attempt temperature spike after arrival
    await assert.rejects(
      () => handleTemperatureSpike({
        shipmentId: SHIPMENT_ID,
        temperature: 50,
        threshold: 30,
        sensorId: 'S-99'
      }),
      (err) => {
        assert.match(err.message, /Invalid command/);
        return true;
      }
    );

    // Attempt another arrival
    await assert.rejects(
      () => handleArriveAtPort({
        shipmentId: SHIPMENT_ID,
        port: 'Seattle'
      }),
      (err) => {
        assert.match(err.message, /Invalid command/);
        return true;
      }
    );

    // Store should still only have the original 3 events
    assert.strictEqual(store.length, countAtArrival, 'no events should be added after terminal state');
  } finally {
    teardown();
  }
});
