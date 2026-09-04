const test = require('node:test');
const assert = require('node:assert');

const Event = require('../src/models/Event');
const { appendEvent, getEventsByAggregateId } = require('../src/events/eventStore');
const { persistDomainEvent } = require('../src/events/persistDomainEvent');
const { createDomainEvent } = require('../src/events/createDomainEvent');
const { EVENT_TYPES } = require('../src/events/eventTypes');

test('Event Store Persistence - appendEvent', async (t) => {
  await t.test('successfully creates and saves domain event in the event store', async () => {
    const originalSave = Event.prototype.save;
    let savedData = null;

    Event.prototype.save = async function () {
      savedData = this.toObject ? this.toObject() : { ...this._doc };
      return this;
    };

    try {
      const domainEvent = {
        aggregateId: 'SHIP-001',
        eventType: EVENT_TYPES.CONTAINER_CREATED,
        payload: { origin: 'Shanghai', destination: 'Rotterdam', cargo: 'Electronics' },
        timestamp: new Date('2026-09-01T10:00:00Z'),
        version: 1
      };

      const result = await appendEvent(domainEvent);

      assert.ok(result, 'Result of appendEvent should be truthy');
      assert.strictEqual(savedData.aggregateId, 'SHIP-001');
      assert.strictEqual(savedData.eventType, EVENT_TYPES.CONTAINER_CREATED);
      assert.deepStrictEqual(savedData.payload, {
        origin: 'Shanghai',
        destination: 'Rotterdam',
        cargo: 'Electronics'
      });
      assert.strictEqual(savedData.version, 1);
      assert.strictEqual(new Date(savedData.timestamp).toISOString(), '2026-09-01T10:00:00.000Z');
    } finally {
      Event.prototype.save = originalSave;
    }
  });

  await t.test('accurately appends multiple sequential events with varied payloads', async () => {
    const originalSave = Event.prototype.save;
    const savedEvents = [];

    Event.prototype.save = async function () {
      const doc = {
        aggregateId: this.aggregateId,
        eventType: this.eventType,
        payload: this.payload,
        timestamp: this.timestamp,
        version: this.version
      };
      savedEvents.push(doc);
      return doc;
    };

    try {
      const event1 = createDomainEvent('SHIP-002', EVENT_TYPES.CONTAINER_CREATED, { origin: 'Mumbai' }, 1);
      const event2 = createDomainEvent('SHIP-002', EVENT_TYPES.LOADED_ON_SHIP, { vessel: 'MV Ocean', port: 'Mumbai' }, 2);
      const event3 = createDomainEvent('SHIP-002', EVENT_TYPES.TEMPERATURE_SPIKE, { temperature: 32.5, threshold: 25 }, 3);
      const event4 = createDomainEvent('SHIP-002', EVENT_TYPES.ARRIVED_AT_PORT, { port: 'Dubai' }, 4);

      await appendEvent(event1);
      await appendEvent(event2);
      await appendEvent(event3);
      await appendEvent(event4);

      assert.strictEqual(savedEvents.length, 4);
      assert.strictEqual(savedEvents[0].version, 1);
      assert.strictEqual(savedEvents[0].eventType, EVENT_TYPES.CONTAINER_CREATED);
      assert.strictEqual(savedEvents[1].version, 2);
      assert.strictEqual(savedEvents[1].eventType, EVENT_TYPES.LOADED_ON_SHIP);
      assert.strictEqual(savedEvents[2].version, 3);
      assert.strictEqual(savedEvents[2].eventType, EVENT_TYPES.TEMPERATURE_SPIKE);
      assert.strictEqual(savedEvents[3].version, 4);
      assert.strictEqual(savedEvents[3].eventType, EVENT_TYPES.ARRIVED_AT_PORT);
    } finally {
      Event.prototype.save = originalSave;
    }
  });
});

test('Event Store Retrieval - getEventsByAggregateId', async (t) => {
  await t.test('queries with aggregateId filter and sorts by version ascending', async () => {
    const originalFind = Event.find;
    let capturedQuery = null;
    let capturedSort = null;

    const mockEvents = [
      { aggregateId: 'SHIP-100', version: 1, eventType: EVENT_TYPES.CONTAINER_CREATED, payload: {} },
      { aggregateId: 'SHIP-100', version: 2, eventType: EVENT_TYPES.LOADED_ON_SHIP, payload: {} },
      { aggregateId: 'SHIP-100', version: 3, eventType: EVENT_TYPES.ARRIVED_AT_PORT, payload: {} }
    ];

    Event.find = function (query) {
      capturedQuery = query;
      return {
        sort(sortCriteria) {
          capturedSort = sortCriteria;
          return Promise.resolve(mockEvents);
        }
      };
    };

    try {
      const events = await getEventsByAggregateId('SHIP-100');

      assert.deepStrictEqual(capturedQuery, { aggregateId: 'SHIP-100' });
      assert.deepStrictEqual(capturedSort, { version: 1 }, 'Must sort by version in ascending order');
      assert.strictEqual(events.length, 3);
      assert.strictEqual(events[0].version, 1);
      assert.strictEqual(events[1].version, 2);
      assert.strictEqual(events[2].version, 3);
    } finally {
      Event.find = originalFind;
    }
  });

  await t.test('ensures retrieved events are strictly in ascending version order even if unordered in storage', async () => {
    const originalFind = Event.find;

    // Simulate in-memory database storage containing unordered events across aggregates
    const inMemoryDb = [
      { aggregateId: 'SHIP-200', version: 3, eventType: EVENT_TYPES.TEMPERATURE_SPIKE, payload: { temperature: 30 } },
      { aggregateId: 'SHIP-999', version: 1, eventType: EVENT_TYPES.CONTAINER_CREATED, payload: {} },
      { aggregateId: 'SHIP-200', version: 1, eventType: EVENT_TYPES.CONTAINER_CREATED, payload: { origin: 'Hamburg' } },
      { aggregateId: 'SHIP-200', version: 4, eventType: EVENT_TYPES.ARRIVED_AT_PORT, payload: { port: 'Singapore' } },
      { aggregateId: 'SHIP-200', version: 2, eventType: EVENT_TYPES.LOADED_ON_SHIP, payload: { vessel: 'Express-1' } }
    ];

    Event.find = function (query) {
      const filtered = inMemoryDb.filter((e) => e.aggregateId === query.aggregateId);
      return {
        sort(sortCriteria) {
          if (sortCriteria && sortCriteria.version === 1) {
            filtered.sort((a, b) => a.version - b.version);
          }
          return Promise.resolve(filtered);
        }
      };
    };

    try {
      const events = await getEventsByAggregateId('SHIP-200');

      assert.strictEqual(events.length, 4, 'Should only return events matching SHIP-200');
      assert.strictEqual(events[0].version, 1);
      assert.strictEqual(events[0].eventType, EVENT_TYPES.CONTAINER_CREATED);
      assert.strictEqual(events[1].version, 2);
      assert.strictEqual(events[1].eventType, EVENT_TYPES.LOADED_ON_SHIP);
      assert.strictEqual(events[2].version, 3);
      assert.strictEqual(events[2].eventType, EVENT_TYPES.TEMPERATURE_SPIKE);
      assert.strictEqual(events[3].version, 4);
      assert.strictEqual(events[3].eventType, EVENT_TYPES.ARRIVED_AT_PORT);
    } finally {
      Event.find = originalFind;
    }
  });

  await t.test('returns empty array when aggregateId does not exist', async () => {
    const originalFind = Event.find;

    Event.find = function () {
      return {
        sort() {
          return Promise.resolve([]);
        }
      };
    };

    try {
      const events = await getEventsByAggregateId('NON-EXISTENT-SHIP');
      assert.ok(Array.isArray(events));
      assert.strictEqual(events.length, 0);
    } finally {
      Event.find = originalFind;
    }
  });
});

test('Domain Event Persistence - persistDomainEvent', async (t) => {
  await t.test('delegates event appending to eventStore.appendEvent', async () => {
    let appendedEvent = null;
    const mockEventStore = {
      async appendEvent(event) {
        appendedEvent = event;
        return { ...event, _id: 'mock-mongo-id-123' };
      }
    };

    const domainEvent = createDomainEvent('SHIP-300', EVENT_TYPES.CONTAINER_CREATED, { origin: 'Tokyo' }, 1);
    const result = await persistDomainEvent(domainEvent, mockEventStore);

    assert.strictEqual(appendedEvent, domainEvent);
    assert.strictEqual(result._id, 'mock-mongo-id-123');
    assert.strictEqual(result.aggregateId, 'SHIP-300');
    assert.strictEqual(result.version, 1);
  });

  await t.test('throws an error if event parameter is missing', () => {
    const mockEventStore = { appendEvent: async () => {} };
    assert.throws(() => persistDomainEvent(null, mockEventStore), /event is required/);
    assert.throws(() => persistDomainEvent(undefined, mockEventStore), /event is required/);
  });

  await t.test('throws an error if eventStore is missing or lacks appendEvent', () => {
    const domainEvent = { aggregateId: 'SHIP-1', eventType: 'TEST', version: 1 };
    assert.throws(() => persistDomainEvent(domainEvent, null), /eventStore with appendEvent is required/);
    assert.throws(() => persistDomainEvent(domainEvent, {}), /eventStore with appendEvent is required/);
    assert.throws(() => persistDomainEvent(domainEvent, { appendEvent: 'not-a-func' }), /eventStore with appendEvent is required/);
  });
});

test('End-to-End Event Append and Ordered Retrieval Lifecycle', async () => {
  const store = [];
  const originalSave = Event.prototype.save;
  const originalFind = Event.find;

  Event.prototype.save = async function () {
    const doc = {
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

  try {
    const shipmentId = 'SHIP-E2E-999';

    // 1. Append CONTAINER_CREATED
    const ev1 = createDomainEvent(shipmentId, EVENT_TYPES.CONTAINER_CREATED, {
      origin: 'Tokyo',
      destination: 'Los Angeles',
      cargo: 'Semiconductors'
    }, 1);
    await appendEvent(ev1);

    // 2. Append LOADED_ON_SHIP
    const ev2 = createDomainEvent(shipmentId, EVENT_TYPES.LOADED_ON_SHIP, {
      vessel: 'Pacific Voyager',
      port: 'Yokohama Port'
    }, 2);
    await appendEvent(ev2);

    // 3. Append TEMPERATURE_SPIKE
    const ev3 = createDomainEvent(shipmentId, EVENT_TYPES.TEMPERATURE_SPIKE, {
      temperature: 29.4,
      threshold: 22.0,
      sensorId: 'TEMP-SENSOR-9'
    }, 3);
    await appendEvent(ev3);

    // 4. Append ARRIVED_AT_PORT
    const ev4 = createDomainEvent(shipmentId, EVENT_TYPES.ARRIVED_AT_PORT, {
      port: 'Port of Los Angeles'
    }, 4);
    await appendEvent(ev4);

    // Retrieve events
    const retrievedEvents = await getEventsByAggregateId(shipmentId);

    assert.strictEqual(retrievedEvents.length, 4, 'Should retrieve all 4 appended events');

    // Verify ordering and content
    assert.deepStrictEqual(
      retrievedEvents.map((e) => ({ version: e.version, eventType: e.eventType })),
      [
        { version: 1, eventType: EVENT_TYPES.CONTAINER_CREATED },
        { version: 2, eventType: EVENT_TYPES.LOADED_ON_SHIP },
        { version: 3, eventType: EVENT_TYPES.TEMPERATURE_SPIKE },
        { version: 4, eventType: EVENT_TYPES.ARRIVED_AT_PORT }
      ],
      'Events must be returned in strictly sequential version order'
    );

    assert.strictEqual(retrievedEvents[0].payload.cargo, 'Semiconductors');
    assert.strictEqual(retrievedEvents[1].payload.vessel, 'Pacific Voyager');
    assert.strictEqual(retrievedEvents[2].payload.temperature, 29.4);
    assert.strictEqual(retrievedEvents[3].payload.port, 'Port of Los Angeles');
  } finally {
    Event.prototype.save = originalSave;
    Event.find = originalFind;
  }
});
