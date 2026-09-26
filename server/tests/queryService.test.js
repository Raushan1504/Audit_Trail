const test = require('node:test');
const assert = require('node:assert');
const { reconstructShipmentState } = require('../src/domain/shipmentReconstruction');
const { EVENT_TYPES } = require('../src/events/eventTypes');
const queryService = require('../src/queries/queryService');
const queryController = require('../src/queries/queryController');
const ShipmentReadModel = require('../src/models/ShipmentReadModel');
const Event = require('../src/models/Event');
const eventStore = require('../src/events/eventStore');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
}

test('reconstructShipmentState throws error if shipmentId or events are invalid', () => {
  assert.throws(() => reconstructShipmentState(null, []), /shipmentId is required/);
  assert.throws(() => reconstructShipmentState('SHIP-001', null), /events must be an array/);
});

test('reconstructShipmentState reconstructs correct state after event sequence', () => {
  const shipmentId = 'SHIP-001';
  const events = [
    {
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      payload: { origin: 'Shanghai', destination: 'Rotterdam' },
      version: 1,
      timestamp: new Date('2026-08-01T00:00:00Z')
    },
    {
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.LOADED_ON_SHIP,
      payload: { vessel: 'Ever Given', port: 'Shanghai Port' },
      version: 2,
      timestamp: new Date('2026-08-02T00:00:00Z')
    },
    {
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
      payload: { temperature: 28.5, threshold: 25.0, sensorId: 'SENSOR-1' },
      version: 3,
      timestamp: new Date('2026-08-03T00:00:00Z')
    },
    {
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.ARRIVED_AT_PORT,
      payload: { port: 'Rotterdam Port' },
      version: 4,
      timestamp: new Date('2026-08-04T00:00:00Z')
    }
  ];

  const reconstructed = reconstructShipmentState(shipmentId, events);

  assert.strictEqual(reconstructed.shipmentId, 'SHIP-001');
  assert.strictEqual(reconstructed.status, 'ARRIVED');
  assert.strictEqual(reconstructed.version, 4);
  assert.strictEqual(reconstructed.temperature, 28.5);
  assert.strictEqual(reconstructed.location, 'Rotterdam Port');
  assert.strictEqual(reconstructed.vessel, 'Ever Given');
});

test('queryService.getShipmentState - Fast O(1) Read Model & Resilient Replay', async (t) => {
  const originalFindOne = ShipmentReadModel.findOne;
  const originalGetEvents = eventStore.getEventsByAggregateId;

  t.afterEach(() => {
    ShipmentReadModel.findOne = originalFindOne;
    eventStore.getEventsByAggregateId = originalGetEvents;
  });

  await t.test('fetches directly from ShipmentReadModel for sub-millisecond response', async () => {
    let readModelCalled = false;
    let eventStoreCalled = false;

    ShipmentReadModel.findOne = async (query) => {
      readModelCalled = true;
      assert.strictEqual(query.shipmentId, 'SHIP-FAST-01');
      return {
        shipmentId: 'SHIP-FAST-01',
        status: 'LOADED',
        currentLocation: 'Port of Singapore',
        location: 'Port of Singapore',
        temperature: -18.2,
        lastAppliedVersion: 2,
        version: 2,
        vessel: 'MV PACIFIC',
        cargo: 'Frozen Salmon',
        lastEventTimestamp: new Date('2026-09-01T12:00:00Z'),
        createdAt: new Date('2026-09-01T10:00:00Z'),
        updatedAt: new Date('2026-09-01T12:00:00Z'),
        toObject() { return this; }
      };
    };

    eventStore.getEventsByAggregateId = async () => {
      eventStoreCalled = true;
      return [];
    };

    const state = await queryService.getShipmentState('SHIP-FAST-01');

    assert.strictEqual(readModelCalled, true, 'ShipmentReadModel.findOne must be queried');
    assert.strictEqual(eventStoreCalled, false, 'eventStore should NOT be queried when read model exists');
    assert.strictEqual(state.shipmentId, 'SHIP-FAST-01');
    assert.strictEqual(state.status, 'LOADED');
    assert.strictEqual(state.currentLocation, 'Port of Singapore');
    assert.strictEqual(state.location, 'Port of Singapore');
    assert.strictEqual(state.temperature, -18.2);
    assert.strictEqual(state.lastAppliedVersion, 2);
    assert.strictEqual(state.vessel, 'MV PACIFIC');
    assert.strictEqual(state.cargo, 'Frozen Salmon');
    assert.strictEqual(state._source, 'read_model');
  });

  await t.test('falls back to event replay if shipment is not yet projected in read model', async () => {
    ShipmentReadModel.findOne = async () => null;

    eventStore.getEventsByAggregateId = async (id) => {
      assert.strictEqual(id, 'SHIP-FALLBACK-01');
      return [
        {
          aggregateId: 'SHIP-FALLBACK-01',
          eventType: EVENT_TYPES.CONTAINER_CREATED,
          payload: { origin: 'Tokyo', cargo: 'Robotics' },
          version: 1,
          timestamp: new Date()
        }
      ];
    };

    const state = await queryService.getShipmentState('SHIP-FALLBACK-01');

    assert.ok(state);
    assert.strictEqual(state.shipmentId, 'SHIP-FALLBACK-01');
    assert.strictEqual(state.status, 'CREATED');
    assert.strictEqual(state.version, 1);
    assert.strictEqual(state._source, 'event_replay');
  });

  await t.test('returns null if shipment does not exist in read model or event store', async () => {
    ShipmentReadModel.findOne = async () => null;
    eventStore.getEventsByAggregateId = async () => [];

    const state = await queryService.getShipmentState('NON-EXISTENT');
    assert.strictEqual(state, null);
  });

  await t.test('returns null for empty or non-string shipment ID', async () => {
    assert.strictEqual(await queryService.getShipmentState(null), null);
    assert.strictEqual(await queryService.getShipmentState(''), null);
    assert.strictEqual(await queryService.getShipmentState(123), null);
  });
});

test('queryService.listShipments - Direct Read Model aggregation', async (t) => {
  const originalFind = ShipmentReadModel.find;
  const originalDistinct = Event.distinct;

  t.afterEach(() => {
    ShipmentReadModel.find = originalFind;
    Event.distinct = originalDistinct;
  });

  await t.test('returns list of shipments directly from ShipmentReadModel', async () => {
    ShipmentReadModel.find = () => ({
      sort: () => [
        {
          shipmentId: 'SHIP-001',
          status: 'CREATED',
          currentLocation: 'Shanghai',
          lastAppliedVersion: 1,
          toObject() { return this; }
        },
        {
          shipmentId: 'SHIP-002',
          status: 'ARRIVED',
          currentLocation: 'Rotterdam',
          lastAppliedVersion: 4,
          toObject() { return this; }
        }
      ]
    });

    const list = await queryService.listShipments();
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].shipmentId, 'SHIP-001');
    assert.strictEqual(list[0]._source, 'read_model');
    assert.strictEqual(list[1].shipmentId, 'SHIP-002');
  });
});

test('queryController.getShipmentState - HTTP Response & Performance Headers', async (t) => {
  const originalGetState = queryService.getShipmentState;

  t.afterEach(() => {
    queryService.getShipmentState = originalGetState;
  });

  await t.test('returns 200 with X-Query-Source and X-Response-Time-Ms headers for :id', async () => {
    queryService.getShipmentState = async (id) => ({
      shipmentId: id,
      status: 'LOADED',
      currentLocation: 'Antwerp',
      lastAppliedVersion: 2,
      _source: 'read_model'
    });

    const req = { params: { id: 'SHIP-HTTP-01' } };
    const res = createMockRes();
    let nextCalled = false;

    await queryController.getShipmentState(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['X-Query-Source'], 'read_model');
    assert.ok(res.headers['X-Response-Time-Ms'], 'Should include X-Response-Time-Ms header');
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.shipmentId, 'SHIP-HTTP-01');
  });

  await t.test('returns 404 when shipment is not found', async () => {
    queryService.getShipmentState = async () => null;

    const req = { params: { id: 'UNKNOWN-SHIP' } };
    const res = createMockRes();

    await queryController.getShipmentState(req, res, () => {});

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /not found/i);
  });
});
