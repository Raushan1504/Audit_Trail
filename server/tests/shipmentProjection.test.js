const test = require('node:test');
const assert = require('node:assert');

const {
  projectEvent,
  applyEventToReadModel,
  rebuildShipmentReadModel
} = require('../src/projections/shipmentProjection');
const { EVENT_TYPES } = require('../src/events/eventTypes');
const Event = require('../src/models/Event');
const ShipmentReadModel = require('../src/models/ShipmentReadModel');

test('shipmentProjection - pure projectEvent transformer', async (t) => {
  await t.test('throws error if event is missing or invalid', () => {
    assert.throws(() => projectEvent(null, null), /event is required/);
    assert.throws(() => projectEvent(null, {}), /eventType is required/);
    assert.throws(
      () => projectEvent(null, { eventType: EVENT_TYPES.CONTAINER_CREATED }),
      /aggregateId is required/
    );
  });

  await t.test('projects CONTAINER_CREATED into initial read model state', () => {
    const event = {
      aggregateId: 'SHP-001',
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      version: 1,
      payload: {
        origin: 'Port of Singapore',
        destination: 'Port of Rotterdam',
        cargo: 'Electronics & Semiconductors'
      },
      timestamp: new Date('2026-09-01T10:00:00Z')
    };

    const state = projectEvent(null, event);

    assert.strictEqual(state.shipmentId, 'SHP-001');
    assert.strictEqual(state.status, 'CREATED');
    assert.strictEqual(state.currentLocation, 'Port of Singapore');
    assert.strictEqual(state.cargo, 'Electronics & Semiconductors');
    assert.strictEqual(state.temperature, null);
    assert.strictEqual(state.vessel, null);
    assert.strictEqual(state.lastAppliedVersion, 1);
    assert.strictEqual(state.lastEventTimestamp.toISOString(), '2026-09-01T10:00:00.000Z');
  });

  await t.test('projects LOADED_ON_SHIP into LOADED status with vessel and location', () => {
    const priorState = {
      shipmentId: 'SHP-001',
      status: 'CREATED',
      currentLocation: 'Port of Singapore',
      cargo: 'Electronics & Semiconductors',
      temperature: null,
      vessel: null,
      lastAppliedVersion: 1
    };

    const event = {
      aggregateId: 'SHP-001',
      eventType: EVENT_TYPES.LOADED_ON_SHIP,
      version: 2,
      payload: {
        vessel: 'MV Oceania Trader',
        port: 'Port of Singapore Berth 4'
      },
      timestamp: new Date('2026-09-02T12:00:00Z')
    };

    const nextState = projectEvent(priorState, event);

    assert.strictEqual(nextState.shipmentId, 'SHP-001');
    assert.strictEqual(nextState.status, 'LOADED');
    assert.strictEqual(nextState.vessel, 'MV Oceania Trader');
    assert.strictEqual(nextState.currentLocation, 'Port of Singapore Berth 4');
    assert.strictEqual(nextState.cargo, 'Electronics & Semiconductors');
    assert.strictEqual(nextState.lastAppliedVersion, 2);
    assert.strictEqual(nextState.lastEventTimestamp.toISOString(), '2026-09-02T12:00:00.000Z');
  });

  await t.test('projects TEMPERATURE_SPIKE with telemetry update while preserving logistics fields', () => {
    const priorState = {
      shipmentId: 'SHP-001',
      status: 'LOADED',
      currentLocation: 'Indian Ocean',
      cargo: 'Pharmaceutical Vaccines',
      temperature: 4.0,
      vessel: 'MV Oceania Trader',
      lastAppliedVersion: 2
    };

    const event = {
      aggregateId: 'SHP-001',
      eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
      version: 3,
      payload: {
        temperature: 14.8,
        threshold: 8.0,
        sensorId: 'SENSOR-TEMP-09'
      },
      timestamp: new Date('2026-09-03T16:30:00Z')
    };

    const nextState = projectEvent(priorState, event);

    assert.strictEqual(nextState.shipmentId, 'SHP-001');
    assert.strictEqual(nextState.status, 'TEMPERATURE_SPIKE');
    assert.strictEqual(nextState.temperature, 14.8);
    assert.strictEqual(nextState.currentLocation, 'Indian Ocean');
    assert.strictEqual(nextState.vessel, 'MV Oceania Trader');
    assert.strictEqual(nextState.cargo, 'Pharmaceutical Vaccines');
    assert.strictEqual(nextState.lastAppliedVersion, 3);
  });

  await t.test('projects ARRIVED_AT_PORT into terminal ARRIVED status', () => {
    const priorState = {
      shipmentId: 'SHP-001',
      status: 'TEMPERATURE_SPIKE',
      currentLocation: 'North Sea',
      cargo: 'Pharmaceutical Vaccines',
      temperature: 14.8,
      vessel: 'MV Oceania Trader',
      lastAppliedVersion: 3
    };

    const event = {
      aggregateId: 'SHP-001',
      eventType: EVENT_TYPES.ARRIVED_AT_PORT,
      version: 4,
      payload: {
        port: 'Port of Rotterdam Terminals'
      },
      timestamp: new Date('2026-09-05T08:00:00Z')
    };

    const nextState = projectEvent(priorState, event);

    assert.strictEqual(nextState.shipmentId, 'SHP-001');
    assert.strictEqual(nextState.status, 'ARRIVED');
    assert.strictEqual(nextState.currentLocation, 'Port of Rotterdam Terminals');
    assert.strictEqual(nextState.temperature, 14.8);
    assert.strictEqual(nextState.lastAppliedVersion, 4);
  });

  await t.test('throws descriptive error on unsupported event type', () => {
    assert.throws(
      () =>
        projectEvent(null, {
          aggregateId: 'SHP-UNKNOWN',
          eventType: 'UNKNOWN_LIFECYCLE_EVENT',
          version: 1
        }),
      /Unsupported event type: UNKNOWN_LIFECYCLE_EVENT/
    );
  });
});

test('shipmentProjection - applyEventToReadModel persistence & idempotency', async (t) => {
  // Setup in-memory mock store for ShipmentReadModel
  let readModelStore = new Map();

  const originalFindOne = ShipmentReadModel.findOne;
  const originalSave = ShipmentReadModel.prototype.save;

  t.beforeEach(() => {
    readModelStore.clear();

    ShipmentReadModel.findOne = async function (query) {
      const doc = readModelStore.get(query.shipmentId);
      if (!doc) return null;
      return {
        ...doc,
        toObject: () => ({ ...doc }),
        save: async function () {
          readModelStore.set(doc.shipmentId, { ...this });
          return this;
        }
      };
    };

    ShipmentReadModel.prototype.save = async function () {
      const data = {
        shipmentId: this.shipmentId,
        status: this.status,
        currentLocation: this.currentLocation,
        temperature: this.temperature,
        lastAppliedVersion: this.lastAppliedVersion,
        vessel: this.vessel,
        cargo: this.cargo,
        lastEventTimestamp: this.lastEventTimestamp
      };
      readModelStore.set(this.shipmentId, data);
      return {
        ...data,
        toObject: () => ({ ...data }),
        save: async function () {
          readModelStore.set(data.shipmentId, { ...this });
          return this;
        }
      };
    };
  });

  t.afterEach(() => {
    ShipmentReadModel.findOne = originalFindOne;
    ShipmentReadModel.prototype.save = originalSave;
  });

  await t.test('creates initial read model on first event append', async () => {
    const event = {
      aggregateId: 'SHP-MOCK-1',
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      version: 1,
      payload: { origin: 'Hamburg', cargo: 'Automotive Parts' },
      timestamp: new Date()
    };

    const result = await applyEventToReadModel(event);

    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.reason, 'APPLIED');
    assert.strictEqual(result.shipmentId, 'SHP-MOCK-1');
    assert.strictEqual(result.version, 1);

    const saved = readModelStore.get('SHP-MOCK-1');
    assert.ok(saved);
    assert.strictEqual(saved.status, 'CREATED');
    assert.strictEqual(saved.cargo, 'Automotive Parts');
    assert.strictEqual(saved.currentLocation, 'Hamburg');
  });

  await t.test('idempotency: skips already applied event versions', async () => {
    const eventV1 = {
      aggregateId: 'SHP-IDEMPOTENT-1',
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      version: 1,
      payload: { origin: 'Tokyo', cargo: 'Medical Devices' }
    };

    await applyEventToReadModel(eventV1);

    // Apply the exact same event again
    const duplicateResult = await applyEventToReadModel(eventV1);

    assert.strictEqual(duplicateResult.applied, false);
    assert.strictEqual(duplicateResult.reason, 'ALREADY_APPLIED');
    assert.strictEqual(duplicateResult.version, 1);
  });

  await t.test('updates existing read model document sequentially', async () => {
    const eventV1 = {
      aggregateId: 'SHP-SEQ-1',
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      version: 1,
      payload: { origin: 'Mumbai', cargo: 'Spices' }
    };
    const eventV2 = {
      aggregateId: 'SHP-SEQ-1',
      eventType: EVENT_TYPES.LOADED_ON_SHIP,
      version: 2,
      payload: { vessel: 'INS Sagar', port: 'Nhava Sheva' }
    };

    await applyEventToReadModel(eventV1);
    const result2 = await applyEventToReadModel(eventV2);

    assert.strictEqual(result2.applied, true);
    assert.strictEqual(result2.version, 2);

    const saved = readModelStore.get('SHP-SEQ-1');
    assert.strictEqual(saved.status, 'LOADED');
    assert.strictEqual(saved.vessel, 'INS Sagar');
    assert.strictEqual(saved.currentLocation, 'Nhava Sheva');
    assert.strictEqual(saved.cargo, 'Spices');
    assert.strictEqual(saved.lastAppliedVersion, 2);
  });
});
