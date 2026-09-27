const test = require('node:test');
const assert = require('node:assert');

const { ProjectionWorker } = require('../src/projections/projectionWorker');
const { eventBus, EVENT_HOOKS } = require('../src/events/eventHandlers');
const { EVENT_TYPES } = require('../src/events/eventTypes');
const Event = require('../src/models/Event');
const ShipmentReadModel = require('../src/models/ShipmentReadModel');

test('ProjectionWorker - Lifecycle and Configuration', async (t) => {
  const originalDistinct = Event.distinct;
  const originalFind = Event.find;

  t.beforeEach(() => {
    Event.distinct = async () => [];
    Event.find = () => ({
      sort: () => ({ limit: () => [] })
    });
  });

  t.afterEach(() => {
    Event.distinct = originalDistinct;
    Event.find = originalFind;
  });

  await t.test('initializes with default options and stopped state', () => {
    const worker = new ProjectionWorker();
    const stats = worker.getStats();

    assert.strictEqual(worker.isRunning, false);
    assert.strictEqual(stats.isRunning, false);
    assert.strictEqual(stats.intervalMs, 2000);
    assert.strictEqual(stats.batchSize, 100);
    assert.strictEqual(stats.processedEventsCount, 0);
  });

  await t.test('start() and stop() transition worker state and timers', () => {
    const worker = new ProjectionWorker({ intervalMs: 5000, autoHook: false });

    worker.start();
    assert.strictEqual(worker.isRunning, true);
    assert.ok(worker.timer);

    worker.stop();
    assert.strictEqual(worker.isRunning, false);
    assert.strictEqual(worker.timer, null);
  });
});

test('ProjectionWorker - Real-Time Event Hook Processing', async (t) => {
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

  await t.test('detects event via hook and immediately updates ShipmentReadModel', async () => {
    const worker = new ProjectionWorker({ intervalMs: 10000 });
    worker.attachHook();

    const domainEvent = {
      aggregateId: 'SHP-HOOK-01',
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      version: 1,
      payload: { origin: 'Port of Colombo', cargo: 'Tea & Textiles' },
      timestamp: new Date('2026-09-10T10:00:00Z')
    };

    let projectedNotification = null;
    worker.once('eventProjected', (payload) => {
      projectedNotification = payload;
    });

    // Simulate eventStore emitting new appended event
    eventBus.emit(EVENT_HOOKS.EVENT_APPENDED, domainEvent);

    // Give event loop tick for async hook
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(projectedNotification, 'Worker should emit eventProjected on hook trigger');
    assert.strictEqual(projectedNotification.source, 'hook');
    assert.strictEqual(projectedNotification.event.aggregateId, 'SHP-HOOK-01');

    const readModel = readModelStore.get('SHP-HOOK-01');
    assert.ok(readModel);
    assert.strictEqual(readModel.status, 'CREATED');
    assert.strictEqual(readModel.currentLocation, 'Port of Colombo');
    assert.strictEqual(readModel.cargo, 'Tea & Textiles');
    assert.strictEqual(readModel.lastAppliedVersion, 1);

    worker.detachHook();
  });
});

test('ProjectionWorker - Background Polling Loop and Catch-Up', async (t) => {
  let eventLog = [];
  let readModelStore = new Map();

  const originalEventFind = Event.find;
  const originalEventDistinct = Event.distinct;
  const originalReadModelFindOne = ShipmentReadModel.findOne;
  const originalReadModelSave = ShipmentReadModel.prototype.save;

  t.beforeEach(() => {
    eventLog = [];
    readModelStore.clear();

    Event.distinct = async function () {
      return [...new Set(eventLog.map((e) => e.aggregateId))];
    };

    Event.find = function (query) {
      let filtered = eventLog.filter((e) => e.aggregateId === query.aggregateId);
      if (query.version && query.version.$gt !== undefined) {
        filtered = filtered.filter((e) => e.version > query.version.$gt);
      }
      return {
        sort: () => ({
          limit: (n) => filtered.slice(0, n)
        })
      };
    };

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
    Event.find = originalEventFind;
    Event.distinct = originalEventDistinct;
    ShipmentReadModel.findOne = originalReadModelFindOne;
    ShipmentReadModel.prototype.save = originalReadModelSave;
  });

  await t.test('pollOnce() processes all unapplied events across shipments', async () => {
    // Seed unapplied events directly into Event store
    eventLog.push(
      {
        aggregateId: 'SHP-POLL-1',
        eventType: EVENT_TYPES.CONTAINER_CREATED,
        version: 1,
        payload: { origin: 'Busan', cargo: 'Machinery' }
      },
      {
        aggregateId: 'SHP-POLL-1',
        eventType: EVENT_TYPES.LOADED_ON_SHIP,
        version: 2,
        payload: { vessel: 'Pacific Star', port: 'Busan Pier 1' }
      },
      {
        aggregateId: 'SHP-POLL-2',
        eventType: EVENT_TYPES.CONTAINER_CREATED,
        version: 1,
        payload: { origin: 'Dubai', cargo: 'Dry Goods' }
      }
    );

    const worker = new ProjectionWorker({ autoHook: false });
    const result = await worker.pollOnce();

    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.processedCount, 3);

    const shp1 = readModelStore.get('SHP-POLL-1');
    assert.strictEqual(shp1.status, 'LOADED');
    assert.strictEqual(shp1.lastAppliedVersion, 2);
    assert.strictEqual(shp1.vessel, 'Pacific Star');

    const shp2 = readModelStore.get('SHP-POLL-2');
    assert.strictEqual(shp2.status, 'CREATED');
    assert.strictEqual(shp2.lastAppliedVersion, 1);
  });

  await t.test('subsequent pollOnce() is idempotent and processes 0 new events', async () => {
    eventLog.push({
      aggregateId: 'SHP-IDEM-POLL',
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      version: 1,
      payload: { origin: 'Tokyo', cargo: 'Automotive' }
    });

    const worker = new ProjectionWorker({ autoHook: false });

    const firstPoll = await worker.pollOnce();
    assert.strictEqual(firstPoll.processedCount, 1);

    const secondPoll = await worker.pollOnce();
    assert.strictEqual(secondPoll.processedCount, 0);
  });

  await t.test('gracefully captures and emits errors during processing', async () => {
    eventLog.push({
      aggregateId: 'SHP-ERR',
      eventType: 'INVALID_TYPE',
      version: 1
    });

    const worker = new ProjectionWorker({ autoHook: false });
    let emittedError = null;

    worker.on('error', (err) => {
      emittedError = err;
    });

    await assert.rejects(async () => {
      await worker.pollOnce();
    }, /Unsupported event type/);

    assert.ok(emittedError);
    assert.strictEqual(worker.getStats().errorsCount, 1);
  });
});

test('ProjectionWorker - End-to-End Command to Read Model Integration', async (t) => {
  const { handleCreateShipment, handleLoadShipment } = require('../src/commands/commandService');
  const eventLog = [];
  const readModelStore = new Map();

  const originalEventSave = Event.prototype.save;
  const originalEventFind = Event.find;
  const originalReadModelFindOne = ShipmentReadModel.findOne;
  const originalReadModelSave = ShipmentReadModel.prototype.save;

  t.beforeEach(() => {
    eventLog.length = 0;
    readModelStore.clear();

    Event.prototype.save = async function () {
      const doc = {
        aggregateId: this.aggregateId,
        eventType: this.eventType,
        payload: this.payload,
        timestamp: this.timestamp || new Date(),
        version: this.version
      };
      eventLog.push(doc);
      return doc;
    };

    Event.find = function (query) {
      const filtered = eventLog.filter((e) => e.aggregateId === query.aggregateId);
      return {
        sort: () => filtered
      };
    };

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
    Event.prototype.save = originalEventSave;
    Event.find = originalEventFind;
    ShipmentReadModel.findOne = originalReadModelFindOne;
    ShipmentReadModel.prototype.save = originalReadModelSave;
  });

  await t.test('command execution triggers hook and automatically updates ShipmentReadModel', async () => {
    const worker = new ProjectionWorker({ autoPoll: false });
    worker.attachHook();

    // 1. Dispatch CreateShipment command
    await handleCreateShipment({
      shipmentId: 'SHP-E2E-99',
      origin: 'Port of Tokyo',
      destination: 'Port of Los Angeles',
      cargo: 'Autonomous EV Batteries'
    });

    // Allow event tick for async hook
    await new Promise((resolve) => setTimeout(resolve, 50));

    const v1Snapshot = readModelStore.get('SHP-E2E-99');
    assert.ok(v1Snapshot, 'Read model should be created automatically by worker hook');
    assert.strictEqual(v1Snapshot.shipmentId, 'SHP-E2E-99');
    assert.strictEqual(v1Snapshot.status, 'CREATED');
    assert.strictEqual(v1Snapshot.cargo, 'Autonomous EV Batteries');
    assert.strictEqual(v1Snapshot.currentLocation, 'Port of Tokyo');
    assert.strictEqual(v1Snapshot.lastAppliedVersion, 1);

    // 2. Dispatch LoadShipment command
    await handleLoadShipment({
      shipmentId: 'SHP-E2E-99',
      vessel: 'Solaris Voyager',
      port: 'Yokohama Terminal 2'
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const v2Snapshot = readModelStore.get('SHP-E2E-99');
    assert.strictEqual(v2Snapshot.status, 'LOADED');
    assert.strictEqual(v2Snapshot.vessel, 'Solaris Voyager');
    assert.strictEqual(v2Snapshot.currentLocation, 'Yokohama Terminal 2');
    assert.strictEqual(v2Snapshot.lastAppliedVersion, 2);

    worker.detachHook();
  });
});

