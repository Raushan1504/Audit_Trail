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

test('queryService.getShipmentStateAsOf - Historical State Reconstruction without Read Model Mutation', async (t) => {
  const originalFindOne = ShipmentReadModel.findOne;
  const originalGetEvents = eventStore.getEventsByAggregateId;

  t.afterEach(() => {
    ShipmentReadModel.findOne = originalFindOne;
    eventStore.getEventsByAggregateId = originalGetEvents;
  });

  const testEvents = [
    {
      aggregateId: 'SHIP-ASOF-01',
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      version: 1,
      timestamp: new Date('2026-08-01T10:00:00.000Z'),
      payload: { origin: 'Port of Hamburg', cargo: 'Precision Machinery' }
    },
    {
      aggregateId: 'SHIP-ASOF-01',
      eventType: EVENT_TYPES.LOADED_ON_SHIP,
      version: 2,
      timestamp: new Date('2026-08-01T14:00:00.000Z'),
      payload: { port: 'Hamburg Marine Terminal', vessel: 'MV ATLANTIC' }
    },
    {
      aggregateId: 'SHIP-ASOF-01',
      eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
      version: 3,
      timestamp: new Date('2026-08-01T18:00:00.000Z'),
      payload: { temperature: 18.5, threshold: 4.0 }
    },
    {
      aggregateId: 'SHIP-ASOF-01',
      eventType: EVENT_TYPES.ARRIVED_AT_PORT,
      version: 4,
      timestamp: new Date('2026-08-01T22:00:00.000Z'),
      payload: { port: 'Port of New York' }
    }
  ];

  await t.test('reconstructs historical state at target version 2 without querying ShipmentReadModel', async () => {
    let readModelAccessed = false;
    ShipmentReadModel.findOne = async () => {
      readModelAccessed = true;
      return null;
    };

    eventStore.getEventsByAggregateId = async (id) => {
      assert.strictEqual(id, 'SHIP-ASOF-01');
      return testEvents;
    };

    const state = await queryService.getShipmentStateAsOf('SHIP-ASOF-01', '2');

    assert.strictEqual(readModelAccessed, false, 'ShipmentReadModel must not be accessed during historical as-of query');
    assert.strictEqual(state.shipmentId, 'SHIP-ASOF-01');
    assert.strictEqual(state.status, 'LOADED');
    assert.strictEqual(state.version, 2);
    assert.strictEqual(state.location, 'Hamburg Marine Terminal');
    assert.strictEqual(state.vessel, 'MV ATLANTIC');
    assert.strictEqual(state.temperature, null);
    assert.strictEqual(state.cargo, 'Precision Machinery');
    assert.strictEqual(state._source, 'historical_reconstruction');
    assert.strictEqual(state.asOf.type, 'version');
    assert.strictEqual(state.asOf.targetVersion, 2);
    assert.strictEqual(state.asOf.effectiveVersion, 2);
    assert.strictEqual(state.asOf.totalHistoricalEvents, 2);
    assert.strictEqual(state.asOf.totalAvailableEvents, 4);
  });

  await t.test('supports version target formatted with leading v like v3', async () => {
    eventStore.getEventsByAggregateId = async () => testEvents;

    const state = await queryService.getShipmentStateAsOf('SHIP-ASOF-01', 'v3');
    assert.strictEqual(state.version, 3);
    assert.strictEqual(state.status, 'TEMPERATURE_SPIKE');
    assert.strictEqual(state.temperature, 18.5);
    assert.strictEqual(state.asOf.type, 'version');
    assert.strictEqual(state.asOf.targetVersion, 3);
  });

  await t.test('reconstructs historical state as of an ISO timestamp cutoff', async () => {
    eventStore.getEventsByAggregateId = async () => testEvents;

    // Cutoff between event 2 (14:00) and event 3 (18:00)
    const state = await queryService.getShipmentStateAsOf('SHIP-ASOF-01', '2026-08-01T15:00:00.000Z');

    assert.strictEqual(state.shipmentId, 'SHIP-ASOF-01');
    assert.strictEqual(state.version, 2);
    assert.strictEqual(state.status, 'LOADED');
    assert.strictEqual(state.location, 'Hamburg Marine Terminal');
    assert.strictEqual(state.asOf.type, 'timestamp');
    assert.strictEqual(state.asOf.effectiveVersion, 2);
    assert.strictEqual(state.asOf.totalHistoricalEvents, 2);
  });

  await t.test('reconstructs initial state for target version 0', async () => {
    eventStore.getEventsByAggregateId = async () => testEvents;

    const state = await queryService.getShipmentStateAsOf('SHIP-ASOF-01', 0);
    assert.strictEqual(state.version, 0);
    assert.strictEqual(state.status, 'CREATED');
    assert.strictEqual(state.asOf.effectiveVersion, 0);
    assert.strictEqual(state.asOf.totalHistoricalEvents, 0);
  });

  await t.test('returns null if shipment aggregate does not exist', async () => {
    eventStore.getEventsByAggregateId = async () => [];

    const state = await queryService.getShipmentStateAsOf('NON-EXISTENT', 2);
    assert.strictEqual(state, null);
  });

  await t.test('throws BadRequestError if target parameter is missing', async () => {
    await assert.rejects(
      () => queryService.getShipmentStateAsOf('SHIP-ASOF-01', null),
      /Target parameter is required/
    );
  });

  await t.test('throws BadRequestError if target is neither a valid version nor ISO timestamp', async () => {
    eventStore.getEventsByAggregateId = async () => testEvents;

    await assert.rejects(
      () => queryService.getShipmentStateAsOf('SHIP-ASOF-01', 'not-a-valid-target'),
      /Invalid target/
    );
  });

  await t.test('throws BadRequestError if target version is greater than available history', async () => {
    eventStore.getEventsByAggregateId = async () => testEvents;

    await assert.rejects(
      () => queryService.getShipmentStateAsOf('SHIP-ASOF-01', 99),
      /targetVersion 99 is not available/
    );
  });
});

test('queryController.getShipmentStateAsOf - HTTP Response & Performance Headers', async (t) => {
  const originalGetStateAsOf = queryService.getShipmentStateAsOf;

  t.afterEach(() => {
    queryService.getShipmentStateAsOf = originalGetStateAsOf;
  });

  await t.test('returns 200 with X-Query-Source and X-Response-Time-Ms headers for :id/as-of/:target', async () => {
    queryService.getShipmentStateAsOf = async (id, target) => ({
      shipmentId: id,
      status: 'LOADED',
      location: 'Hamburg Port',
      version: 2,
      _source: 'historical_reconstruction',
      asOf: { target, type: 'version', effectiveVersion: 2 }
    });

    const req = { params: { id: 'SHIP-HTTP-ASOF', target: '2' } };
    const res = createMockRes();
    let nextCalled = false;

    await queryController.getShipmentStateAsOf(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['X-Query-Source'], 'historical_reconstruction');
    assert.ok(res.headers['X-Response-Time-Ms'], 'Should include X-Response-Time-Ms header');
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.shipmentId, 'SHIP-HTTP-ASOF');
    assert.strictEqual(res.body.data.version, 2);
  });

  await t.test('returns 404 when shipment is not found for historical as-of query', async () => {
    queryService.getShipmentStateAsOf = async () => null;

    const req = { params: { id: 'UNKNOWN-SHIP', target: '1' } };
    const res = createMockRes();

    await queryController.getShipmentStateAsOf(req, res, () => {});

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /not found/i);
  });

  await t.test('forwards errors to next middleware on invalid target', async () => {
    queryService.getShipmentStateAsOf = async () => {
      throw new Error('Invalid target');
    };

    const req = { params: { id: 'SHIP-ERR', target: 'invalid' } };
    const res = createMockRes();
    let forwardError = null;

    await queryController.getShipmentStateAsOf(req, res, (err) => { forwardError = err; });

    assert.ok(forwardError);
    assert.strictEqual(forwardError.message, 'Invalid target');
  });
});

