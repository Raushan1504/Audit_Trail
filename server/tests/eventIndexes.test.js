const test = require('node:test');
const assert = require('node:assert');
const Event = require('../src/models/Event');
const { appendEvent } = require('../src/events/eventStore');
const { EVENT_TYPES } = require('../src/events/eventTypes');

test('Event model schema defines expected event store indexes', () => {
  const indexes = Event.schema.indexes();

  const hasAggregateVersionUnique = indexes.some(
    ([fields, options]) => fields.aggregateId === 1 && fields.version === 1 && options?.unique === true
  );
  const hasAggregateTimestamp = indexes.some(
    ([fields]) => fields.aggregateId === 1 && fields.timestamp === 1
  );
  const hasTimestampGlobal = indexes.some(
    ([fields]) => fields.timestamp === 1 && Object.keys(fields).length === 1
  );
  const hasEventTypeTimestamp = indexes.some(
    ([fields]) => fields.eventType === 1 && fields.timestamp === 1
  );

  assert.strictEqual(hasAggregateVersionUnique, true, 'Should define unique compound index on { aggregateId: 1, version: 1 }');
  assert.strictEqual(hasAggregateTimestamp, true, 'Should define compound index on { aggregateId: 1, timestamp: 1 }');
  assert.strictEqual(hasTimestampGlobal, true, 'Should define index on { timestamp: 1 } for global ordering');
  assert.strictEqual(hasEventTypeTimestamp, true, 'Should define compound index on { eventType: 1, timestamp: 1 }');
});

test('Event model schema disables Mongoose versionKey', () => {
  assert.strictEqual(Event.schema.options.versionKey, false, 'Mongoose versionKey (__v) should be disabled');
});

test('Event model exposes ensureIndexes helper', () => {
  assert.strictEqual(typeof Event.ensureIndexes, 'function', 'Event.ensureIndexes should be a function');
});

test('Day 22 OCC: Compound unique index { aggregateId: 1, version: 1 } prevents simultaneous duplicate versions', async (t) => {
  const originalSave = Event.prototype.save;
  const persistedEvents = new Map();

  Event.prototype.save = async function () {
    const key = `${this.aggregateId}#${this.version}`;
    if (persistedEvents.has(key)) {
      const duplicateError = new Error(
        `E11000 duplicate key error collection: audit-trail.events index: aggregateId_1_version_1 dup key: { aggregateId: "${this.aggregateId}", version: ${this.version} }`
      );
      duplicateError.code = 11000;
      duplicateError.keyPattern = { aggregateId: 1, version: 1 };
      duplicateError.keyValue = { aggregateId: this.aggregateId, version: this.version };
      throw duplicateError;
    }

    const doc = {
      _id: `mock-event-${persistedEvents.size + 1}`,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      payload: this.payload,
      timestamp: this.timestamp || new Date(),
      version: this.version
    };
    persistedEvents.set(key, doc);
    return doc;
  };

  t.after(() => {
    Event.prototype.save = originalSave;
  });

  await t.test('rejects simultaneous commands attempting to write the same version for an aggregate', async () => {
    const shipmentId = 'SHIP-SIMULTANEOUS-001';

    const command1Event = {
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      payload: { origin: 'Antwerp', destination: 'Singapore', cargo: 'Vaccines' },
      version: 1
    };

    const command2Event = {
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      payload: { origin: 'Rotterdam', destination: 'Shanghai', cargo: 'Electronics' },
      version: 1
    };

    const results = await Promise.allSettled([
      appendEvent(command1Event),
      appendEvent(command2Event)
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one simultaneous command should successfully write version 1');
    assert.strictEqual(rejected.length, 1, 'The competing simultaneous command must be rejected by unique index');

    const rejectionReason = rejected[0].reason;
    assert.strictEqual(rejectionReason.code, 11000, 'Rejection must have MongoDB duplicate key code 11000');
    assert.ok(rejectionReason.message.includes('aggregateId_1_version_1'), 'Error must reference compound unique index');
    assert.deepStrictEqual(rejectionReason.keyPattern, { aggregateId: 1, version: 1 });
    assert.strictEqual(rejectionReason.keyValue.aggregateId, shipmentId);
    assert.strictEqual(rejectionReason.keyValue.version, 1);
  });

  await t.test('enforces version uniqueness during rapid burst concurrency of 5 simultaneous commands', async () => {
    const shipmentId = 'SHIP-BURST-CONCURRENCY-002';

    await appendEvent({
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      payload: { origin: 'Hamburg' },
      version: 1
    });

    const burstPromises = Array.from({ length: 5 }, (_, i) =>
      appendEvent({
        aggregateId: shipmentId,
        eventType: EVENT_TYPES.LOADED_ON_SHIP,
        payload: { vessel: `Vessel-${i + 1}`, port: 'Hamburg' },
        version: 2
      })
    );

    const burstResults = await Promise.allSettled(burstPromises);
    const fulfilled = burstResults.filter((r) => r.status === 'fulfilled');
    const rejected = burstResults.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly 1 burst command must succeed in writing version 2');
    assert.strictEqual(rejected.length, 4, 'All 4 competing burst commands must fail with duplicate key violation');

    rejected.forEach((r) => {
      assert.strictEqual(r.reason.code, 11000);
      assert.strictEqual(r.reason.keyValue.version, 2);
    });
  });

  await t.test('allows simultaneous writes with identical version number across DIFFERENT aggregates', async () => {
    const aggregateA = 'SHIP-INDEPENDENT-A';
    const aggregateB = 'SHIP-INDEPENDENT-B';

    const results = await Promise.allSettled([
      appendEvent({
        aggregateId: aggregateA,
        eventType: EVENT_TYPES.CONTAINER_CREATED,
        payload: { cargo: 'Batch A' },
        version: 1
      }),
      appendEvent({
        aggregateId: aggregateB,
        eventType: EVENT_TYPES.CONTAINER_CREATED,
        payload: { cargo: 'Batch B' },
        version: 1
      })
    ]);

    assert.strictEqual(results[0].status, 'fulfilled', 'Aggregate A version 1 write should succeed');
    assert.strictEqual(results[1].status, 'fulfilled', 'Aggregate B version 1 write should succeed');
  });

  await t.test('allows sequential monotonic version increments for the same aggregate without collision', async () => {
    const shipmentId = 'SHIP-SEQUENTIAL-003';

    const v1 = await appendEvent({
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      payload: { cargo: 'Machinery' },
      version: 1
    });
    assert.strictEqual(v1.version, 1);

    const v2 = await appendEvent({
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.LOADED_ON_SHIP,
      payload: { vessel: 'Nordic Explorer' },
      version: 2
    });
    assert.strictEqual(v2.version, 2);

    const v3 = await appendEvent({
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
      payload: { temperature: 28.5 },
      version: 3
    });
    assert.strictEqual(v3.version, 3);
  });
});
