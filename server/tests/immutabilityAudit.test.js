const test = require('node:test');
const assert = require('node:assert');
const Event = require('../src/models/Event');
const { appendEvent, getEventsByAggregateId } = require('../src/events/eventStore');
const { createDomainEvent } = require('../src/events/createDomainEvent');
const { EVENT_TYPES } = require('../src/events/eventTypes');
const { immutabilityGuard, errorHandler } = require('../src/middleware');

const EXPECTED_APPEND_ONLY_MSG = 'Event store is append-only: update/delete operations are not permitted';

// ═══════════════════════════════════════════════════════════════════════
// MID-PROJECT REVIEW — DAY 14: EVENT STORE IMMUTABILITY AUDIT
// 
// Verification Matrix:
//   APPEND  → ✓ (Permitted)
//   READ    → ✓ (Permitted)
//   UPDATE  → ✗ (Rejected / Prevented)
//   DELETE  → ✗ (Rejected / Prevented)
// ═══════════════════════════════════════════════════════════════════════

test('Day 14 Immutability Audit — Pillar 1: APPEND Works', async (t) => {
  const store = [];
  const originalSave = Event.prototype.save;

  Event.prototype.save = async function () {
    const doc = {
      _id: `id-${store.length + 1}`,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      payload: this.payload,
      timestamp: this.timestamp || new Date(),
      version: this.version
    };
    store.push(doc);
    return doc;
  };

  t.after(() => {
    Event.prototype.save = originalSave;
  });

  await t.test('successfully appends initial container creation event with full metadata', async () => {
    const shipmentId = 'SHIP-AUDIT-001';
    const initialEvent = createDomainEvent(
      shipmentId,
      EVENT_TYPES.CONTAINER_CREATED,
      { origin: 'Singapore', destination: 'Rotterdam', cargo: 'Pharmaceuticals' },
      1
    );

    const persisted = await appendEvent(initialEvent);

    assert.ok(persisted, 'Appended event must be returned');
    assert.strictEqual(persisted.aggregateId, shipmentId);
    assert.strictEqual(persisted.eventType, EVENT_TYPES.CONTAINER_CREATED);
    assert.strictEqual(persisted.version, 1);
    assert.ok(persisted.timestamp, 'Event must have a valid timestamp');
    assert.deepStrictEqual(persisted.payload, {
      origin: 'Singapore',
      destination: 'Rotterdam',
      cargo: 'Pharmaceuticals'
    });
  });

  await t.test('successfully appends full chronological lifecycle events (v1 -> v2 -> v3 -> v4)', async () => {
    const shipmentId = 'SHIP-AUDIT-002';
    const lifecycle = [
      createDomainEvent(shipmentId, EVENT_TYPES.CONTAINER_CREATED, { origin: 'Busan', destination: 'Los Angeles' }, 1),
      createDomainEvent(shipmentId, EVENT_TYPES.LOADED_ON_SHIP, { vessel: 'Pacific Voyager', port: 'Busan' }, 2),
      createDomainEvent(shipmentId, EVENT_TYPES.TEMPERATURE_SPIKE, { temperature: 34.8, threshold: 25.0 }, 3),
      createDomainEvent(shipmentId, EVENT_TYPES.ARRIVED_AT_PORT, { port: 'Los Angeles' }, 4)
    ];

    for (const ev of lifecycle) {
      await appendEvent(ev);
    }

    const savedForShipment = store.filter((e) => e.aggregateId === shipmentId);
    assert.strictEqual(savedForShipment.length, 4, 'All 4 lifecycle events must be appended');
    assert.deepStrictEqual(
      savedForShipment.map((e) => e.version),
      [1, 2, 3, 4],
      'Versions must be strictly sequential'
    );
    assert.strictEqual(savedForShipment[2].payload.temperature, 34.8);
  });
});

test('Day 14 Immutability Audit — Pillar 2: READ Works', async (t) => {
  const store = [
    { aggregateId: 'SHIP-AUDIT-003', version: 1, eventType: EVENT_TYPES.CONTAINER_CREATED, payload: { origin: 'Tokyo' }, timestamp: new Date('2026-09-01') },
    { aggregateId: 'SHIP-AUDIT-003', version: 2, eventType: EVENT_TYPES.LOADED_ON_SHIP, payload: { vessel: 'Nippon Maru' }, timestamp: new Date('2026-09-02') },
    { aggregateId: 'SHIP-AUDIT-003', version: 3, eventType: EVENT_TYPES.TEMPERATURE_SPIKE, payload: { temperature: 31.2 }, timestamp: new Date('2026-09-03') },
    { aggregateId: 'SHIP-AUDIT-003', version: 4, eventType: EVENT_TYPES.ARRIVED_AT_PORT, payload: { port: 'Seattle' }, timestamp: new Date('2026-09-04') }
  ];

  const originalFind = Event.find;
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

  t.after(() => {
    Event.find = originalFind;
  });

  await t.test('retrieves complete historical event log sorted in chronological order', async () => {
    const events = await getEventsByAggregateId('SHIP-AUDIT-003');

    assert.strictEqual(events.length, 4);
    assert.strictEqual(events[0].version, 1);
    assert.strictEqual(events[0].eventType, EVENT_TYPES.CONTAINER_CREATED);
    assert.strictEqual(events[1].version, 2);
    assert.strictEqual(events[1].eventType, EVENT_TYPES.LOADED_ON_SHIP);
    assert.strictEqual(events[2].version, 3);
    assert.strictEqual(events[2].eventType, EVENT_TYPES.TEMPERATURE_SPIKE);
    assert.strictEqual(events[3].version, 4);
    assert.strictEqual(events[3].eventType, EVENT_TYPES.ARRIVED_AT_PORT);
  });

  await t.test('read operations do not mutate or delete historical records', async () => {
    const beforeLength = store.length;
    await getEventsByAggregateId('SHIP-AUDIT-003');
    await getEventsByAggregateId('SHIP-AUDIT-003');
    assert.strictEqual(store.length, beforeLength, 'Read operations must be purely non-mutating');
  });
});

test('Day 14 Immutability Audit — Pillar 3: UPDATE Operations are Rejected', async (t) => {
  await t.test('rejects Event.updateOne() with append-only error', async () => {
    let error = null;
    try {
      await Event.updateOne(
        { aggregateId: 'SHIP-AUDIT-004', version: 1 },
        { $set: { 'payload.cargo': 'Tampered Cargo' } }
      );
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'updateOne must throw an error');
    assert.strictEqual(error.message, EXPECTED_APPEND_ONLY_MSG);
  });

  await t.test('rejects Event.updateMany() with append-only error', async () => {
    let error = null;
    try {
      await Event.updateMany(
        { aggregateId: 'SHIP-AUDIT-004' },
        { $set: { eventType: 'TAMPERED_EVENT' } }
      );
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'updateMany must throw an error');
    assert.strictEqual(error.message, EXPECTED_APPEND_ONLY_MSG);
  });

  await t.test('rejects Event.replaceOne() with append-only error', async () => {
    let error = null;
    try {
      await Event.replaceOne(
        { aggregateId: 'SHIP-AUDIT-004', version: 1 },
        { aggregateId: 'SHIP-AUDIT-004', version: 1, eventType: 'REPLACED' }
      );
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'replaceOne must throw an error');
    assert.strictEqual(error.message, EXPECTED_APPEND_ONLY_MSG);
  });

  await t.test('rejects Event.findOneAndUpdate() with append-only error', async () => {
    let error = null;
    try {
      await Event.findOneAndUpdate(
        { aggregateId: 'SHIP-AUDIT-004', version: 3 },
        { $set: { 'payload.temperature': 20.0 } }
      );
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'findOneAndUpdate must throw an error');
    assert.strictEqual(error.message, EXPECTED_APPEND_ONLY_MSG);
  });

  await t.test('rejects Event.findOneAndReplace() with append-only error', async () => {
    let error = null;
    try {
      await Event.findOneAndReplace(
        { aggregateId: 'SHIP-AUDIT-004', version: 3 },
        { aggregateId: 'SHIP-AUDIT-004', version: 3, eventType: 'CLEARED' }
      );
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'findOneAndReplace must throw an error');
    assert.strictEqual(error.message, EXPECTED_APPEND_ONLY_MSG);
  });

  await t.test('rejects document-level save() on modified existing event (isNew: false)', async () => {
    const existingDoc = new Event({
      aggregateId: 'SHIP-AUDIT-004',
      eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
      payload: { temperature: 34.5 },
      version: 3
    });

    // Mark as persisted existing document
    existingDoc.isNew = false;
    existingDoc.payload.temperature = 18.0; // Adversary tries to falsify temp spike

    let error = null;
    try {
      await existingDoc.save();
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'doc.save() on existing record must be rejected');
    assert.strictEqual(error.message, EXPECTED_APPEND_ONLY_MSG);
  });
});

test('Day 14 Immutability Audit — Pillar 4: DELETE Operations are Rejected', async (t) => {
  await t.test('rejects Event.deleteOne() with append-only error', async () => {
    let error = null;
    try {
      await Event.deleteOne({ aggregateId: 'SHIP-AUDIT-005', version: 1 });
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'deleteOne must throw an error');
    assert.strictEqual(error.message, EXPECTED_APPEND_ONLY_MSG);
  });

  await t.test('rejects Event.deleteMany() with append-only error', async () => {
    let error = null;
    try {
      await Event.deleteMany({ aggregateId: 'SHIP-AUDIT-005' });
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'deleteMany must throw an error');
    assert.strictEqual(error.message, EXPECTED_APPEND_ONLY_MSG);
  });

  await t.test('rejects Event.findOneAndDelete() with append-only error', async () => {
    let error = null;
    try {
      await Event.findOneAndDelete({ aggregateId: 'SHIP-AUDIT-005', version: 2 });
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'findOneAndDelete must throw an error');
    assert.strictEqual(error.message, EXPECTED_APPEND_ONLY_MSG);
  });

  await t.test('rejects document-level deleteOne() on existing event document', async () => {
    const existingDoc = new Event({
      aggregateId: 'SHIP-AUDIT-005',
      eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
      payload: { temperature: 38.0 },
      version: 3
    });
    existingDoc.isNew = false;

    let error = null;
    try {
      await existingDoc.deleteOne();
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'doc.deleteOne() must throw an error');
    assert.strictEqual(error.message, EXPECTED_APPEND_ONLY_MSG);
  });
});

test('Day 14 Immutability Audit — Pillar 5: HTTP Boundary & Error Handling Protection (403 Forbidden)', async (t) => {
  const createMockRes = () => {
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
    return res;
  };

  await t.test('immutabilityGuard middleware blocks HTTP PUT with 403 Forbidden', () => {
    const req = { method: 'PUT', originalUrl: '/api/events/SHIP-001' };
    const res = createMockRes();
    let nextCalled = false;

    immutabilityGuard(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'next() must NOT be called for PUT');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.code, 'IMMUTABLE_EVENT_STORE');
    assert.strictEqual(res.body.error, EXPECTED_APPEND_ONLY_MSG);
  });

  await t.test('immutabilityGuard middleware blocks HTTP PATCH with 403 Forbidden', () => {
    const req = { method: 'PATCH', originalUrl: '/api/events/SHIP-001/version/1' };
    const res = createMockRes();
    let nextCalled = false;

    immutabilityGuard(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'next() must NOT be called for PATCH');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.code, 'IMMUTABLE_EVENT_STORE');
  });

  await t.test('immutabilityGuard middleware blocks HTTP DELETE with 403 Forbidden', () => {
    const req = { method: 'DELETE', originalUrl: '/api/events/SHIP-001' };
    const res = createMockRes();
    let nextCalled = false;

    immutabilityGuard(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'next() must NOT be called for DELETE');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.code, 'IMMUTABLE_EVENT_STORE');
    assert.strictEqual(res.body.error, EXPECTED_APPEND_ONLY_MSG);
  });

  await t.test('immutabilityGuard allows HTTP GET and POST through to handlers', () => {
    const getReq = { method: 'GET', originalUrl: '/api/queries/shipments' };
    const postReq = { method: 'POST', originalUrl: '/api/commands/shipments/create' };
    const res = createMockRes();

    let getPassed = false;
    let postPassed = false;

    immutabilityGuard(getReq, res, () => { getPassed = true; });
    immutabilityGuard(postReq, res, () => { postPassed = true; });

    assert.strictEqual(getPassed, true, 'GET must be allowed');
    assert.strictEqual(postPassed, true, 'POST must be allowed');
  });

  await t.test('central errorHandler maps append-only error to HTTP 403 IMMUTABLE_EVENT_STORE', () => {
    const res = createMockRes();
    const err = new Error(EXPECTED_APPEND_ONLY_MSG);

    errorHandler(err, {}, res, () => {});

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.code, 'IMMUTABLE_EVENT_STORE');
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, EXPECTED_APPEND_ONLY_MSG);
  });
});

test('Day 14 Immutability Audit — Pillar 6: End-to-End Tamper-Proof Audit Simulation', async () => {
  const store = [];
  const originalSave = Event.prototype.save;
  const originalFind = Event.find;

  Event.prototype.save = async function () {
    const doc = {
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      payload: JSON.parse(JSON.stringify(this.payload)),
      timestamp: this.timestamp || new Date(),
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

  try {
    const auditShipmentId = 'SHIP-TAMPER-PROOF-AUDIT';

    // ── Phase 1: APPEND Phase ─────────────────────────────────────────
    const ev1 = createDomainEvent(auditShipmentId, EVENT_TYPES.CONTAINER_CREATED, { origin: 'Tokyo', destination: 'Rotterdam' }, 1);
    const ev2 = createDomainEvent(auditShipmentId, EVENT_TYPES.LOADED_ON_SHIP, { vessel: 'Evergreen 2', port: 'Tokyo' }, 2);
    const ev3 = createDomainEvent(auditShipmentId, EVENT_TYPES.TEMPERATURE_SPIKE, { temperature: 36.5, threshold: 22.0 }, 3);
    const ev4 = createDomainEvent(auditShipmentId, EVENT_TYPES.ARRIVED_AT_PORT, { port: 'Rotterdam' }, 4);

    await appendEvent(ev1);
    await appendEvent(ev2);
    await appendEvent(ev3);
    await appendEvent(ev4);

    // Snapshot state before attack
    const eventsBeforeAttack = await getEventsByAggregateId(auditShipmentId);
    assert.strictEqual(eventsBeforeAttack.length, 4);
    const snapshotJson = JSON.stringify(eventsBeforeAttack);

    // ── Phase 2: Adversarial UPDATE Attacks (All 5 query methods + doc.save) ──
    const attackOperations = [
      () => Event.updateOne({ aggregateId: auditShipmentId, version: 3 }, { $set: { 'payload.temperature': 20.0 } }),
      () => Event.updateMany({ aggregateId: auditShipmentId }, { $set: { eventType: 'FALSIFIED' } }),
      () => Event.replaceOne({ aggregateId: auditShipmentId, version: 1 }, { aggregateId: auditShipmentId, version: 1, eventType: 'EMPTY' }),
      () => Event.findOneAndUpdate({ aggregateId: auditShipmentId, version: 3 }, { $set: { 'payload.temperature': 15.0 } }),
      () => Event.findOneAndReplace({ aggregateId: auditShipmentId, version: 2 }, { aggregateId: auditShipmentId, version: 2, eventType: 'CLEARED' })
    ];

    let blockedAttackCount = 0;
    for (const attack of attackOperations) {
      try {
        await attack();
      } catch (err) {
        if (err.message === EXPECTED_APPEND_ONLY_MSG) {
          blockedAttackCount++;
        }
      }
    }
    assert.strictEqual(blockedAttackCount, 5, 'All 5 update attacks must be blocked');

    // ── Phase 3: Adversarial DELETE Attacks (All 3 query methods) ─────────
    const deleteAttacks = [
      () => Event.deleteOne({ aggregateId: auditShipmentId, version: 3 }),
      () => Event.deleteMany({ aggregateId: auditShipmentId }),
      () => Event.findOneAndDelete({ aggregateId: auditShipmentId, version: 1 })
    ];

    let blockedDeleteCount = 0;
    for (const attack of deleteAttacks) {
      try {
        await attack();
      } catch (err) {
        if (err.message === EXPECTED_APPEND_ONLY_MSG) {
          blockedDeleteCount++;
        }
      }
    }
    assert.strictEqual(blockedDeleteCount, 3, 'All 3 delete attacks must be blocked');

    // ── Phase 4: State Integrity Verification ─────────────────────────
    const eventsAfterAttack = await getEventsByAggregateId(auditShipmentId);
    assert.strictEqual(eventsAfterAttack.length, 4, 'Event count must remain exactly 4');
    assert.strictEqual(
      JSON.stringify(eventsAfterAttack),
      snapshotJson,
      'Post-attack event store state must be byte-for-byte identical to original snapshot'
    );

    // Verify specific critical payload values remained unchanged
    assert.strictEqual(eventsAfterAttack[2].payload.temperature, 36.5, 'Temp spike must not have been tampered');
    assert.strictEqual(eventsAfterAttack[0].eventType, EVENT_TYPES.CONTAINER_CREATED);
    assert.strictEqual(eventsAfterAttack[1].eventType, EVENT_TYPES.LOADED_ON_SHIP);
    assert.strictEqual(eventsAfterAttack[2].eventType, EVENT_TYPES.TEMPERATURE_SPIKE);
    assert.strictEqual(eventsAfterAttack[3].eventType, EVENT_TYPES.ARRIVED_AT_PORT);
  } finally {
    Event.prototype.save = originalSave;
    Event.find = originalFind;
  }
});
