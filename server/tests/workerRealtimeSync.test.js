
const test = require('node:test');
const assert = require('node:assert');
const { performance } = require('node:perf_hooks');

const Event = require('../src/models/Event');
const ShipmentReadModel = require('../src/models/ShipmentReadModel');
const {
  handleCreateShipment,
  handleLoadShipment,
  handleTemperatureSpike,
  handleArriveAtPort
} = require('../src/commands/commandService');
const { getShipmentState, listShipments } = require('../src/queries/queryService');
const { ProjectionWorker } = require('../src/projections/projectionWorker');
const { eventBus } = require('../src/events/eventHandlers');

const SLA_THRESHOLD_MS = 200;

function setupHarness() {
  const eventLog = [];
  const readModelStore = new Map();

  const originalEventSave = Event.prototype.save;
  const originalEventFind = Event.find;
  const originalEventDistinct = Event.distinct;
  const originalReadModelFindOne = ShipmentReadModel.findOne;
  const originalReadModelFind = ShipmentReadModel.find;
  const originalReadModelSave = ShipmentReadModel.prototype.save;
  const originalReadModelDeleteMany = ShipmentReadModel.deleteMany;

  Event.prototype.save = async function () {
    const doc = {
      _id: `evt-${eventLog.length + 1}`,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      payload: this.payload,
      timestamp: this.timestamp || new Date(),
      version: this.version
    };
    eventLog.push(doc);
    return doc;
  };

  Event.find = function (query = {}) {
    let filtered = eventLog;
    if (query.aggregateId) {
      filtered = filtered.filter((e) => e.aggregateId === query.aggregateId);
    }
    if (query.version && query.version.$gt !== undefined) {
      filtered = filtered.filter((e) => e.version > query.version.$gt);
    }
    if (query.version && query.version.$lte !== undefined) {
      filtered = filtered.filter((e) => e.version <= query.version.$lte);
    }

    return {
      sort(criteria) {
        if (criteria && criteria.version === 1) {
          filtered.sort((a, b) => a.version - b.version);
        }
        return {
          limit(n) {
            return Promise.resolve(filtered.slice(0, n));
          },
          then(resolve) {
            return Promise.resolve(filtered).then(resolve);
          }
        };
      },
      then(resolve) {
        return Promise.resolve(filtered).then(resolve);
      }
    };
  };

  Event.distinct = async function (field) {
    if (field === 'aggregateId') {
      return [...new Set(eventLog.map((e) => e.aggregateId))];
    }
    return [];
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

  ShipmentReadModel.find = function () {
    const docs = Array.from(readModelStore.values()).map((doc) => ({
      ...doc,
      toObject: () => ({ ...doc })
    }));
    return {
      sort() {
        return Promise.resolve(docs);
      },
      then(resolve) {
        return Promise.resolve(docs).then(resolve);
      }
    };
  };

  ShipmentReadModel.prototype.save = async function () {
    const data = {
      shipmentId: this.shipmentId,
      status: this.status,
      currentLocation: this.currentLocation,
      location: this.currentLocation,
      temperature: this.temperature,
      lastAppliedVersion: this.lastAppliedVersion ?? this.version ?? 0,
      version: this.lastAppliedVersion ?? this.version ?? 0,
      vessel: this.vessel,
      cargo: this.cargo,
      lastEventTimestamp: this.lastEventTimestamp || new Date(),
      createdAt: this.createdAt || new Date(),
      updatedAt: new Date()
    };
    readModelStore.set(this.shipmentId, data);
    return {
      ...data,
      toObject: () => ({ ...data }),
      save: async function () {
        readModelStore.set(data.shipmentId, { ...this, updatedAt: new Date() });
        return this;
      }
    };
  };

  ShipmentReadModel.deleteMany = async function () {
    readModelStore.clear();
    return { acknowledged: true, deletedCount: readModelStore.size };
  };

  return {
    eventLog,
    readModelStore,
    teardown() {
      eventBus.removeAllListeners();
      Event.prototype.save = originalEventSave;
      Event.find = originalEventFind;
      Event.distinct = originalEventDistinct;
      ShipmentReadModel.findOne = originalReadModelFindOne;
      ShipmentReadModel.find = originalReadModelFind;
      ShipmentReadModel.prototype.save = originalReadModelSave;
      ShipmentReadModel.deleteMany = originalReadModelDeleteMany;
    }
  };
}

test('Worker Real-Time Sync — Latency SLA (< 200ms) Across All Command Types', async (t) => {
  const harness = setupHarness();
  const worker = new ProjectionWorker({ autoPoll: false });
  worker.attachHook();

  t.after(() => {
    worker.stop();
    harness.teardown();
  });

  await t.test('CreateShipment immediately updates ShipmentReadModel within 200ms', async () => {
    const shipmentId = 'SYNC-TEST-001';
    const startTime = performance.now();

    await handleCreateShipment({
      shipmentId,
      origin: 'Port of Singapore Berth 4',
      destination: 'Port of Rotterdam',
      cargo: 'Pharmaceutical Vaccines'
    });

    const readModel = await worker.waitForVersion(shipmentId, 1, SLA_THRESHOLD_MS);
    const syncDuration = performance.now() - startTime;

    assert.ok(readModel, 'ShipmentReadModel document must exist');
    assert.strictEqual(readModel.shipmentId, shipmentId);
    assert.strictEqual(readModel.status, 'CREATED');
    assert.strictEqual(readModel.currentLocation, 'Port of Singapore Berth 4');
    assert.strictEqual(readModel.cargo, 'Pharmaceutical Vaccines');
    assert.strictEqual(readModel.lastAppliedVersion, 1);
    assert.ok(
      syncDuration < SLA_THRESHOLD_MS,
      `CreateShipment sync took ${syncDuration.toFixed(2)}ms (SLA: < ${SLA_THRESHOLD_MS}ms)`
    );
  });

  await t.test('LoadShipment immediately updates ShipmentReadModel within 200ms', async () => {
    const shipmentId = 'SYNC-TEST-001';
    const startTime = performance.now();

    await handleLoadShipment({
      shipmentId,
      vessel: 'MV Oceania Carrier',
      port: 'Singapore Container Terminal'
    });

    const readModel = await worker.waitForVersion(shipmentId, 2, SLA_THRESHOLD_MS);
    const syncDuration = performance.now() - startTime;

    assert.ok(readModel);
    assert.strictEqual(readModel.status, 'LOADED');
    assert.strictEqual(readModel.vessel, 'MV Oceania Carrier');
    assert.strictEqual(readModel.currentLocation, 'Singapore Container Terminal');
    assert.strictEqual(readModel.lastAppliedVersion, 2);
    assert.ok(
      syncDuration < SLA_THRESHOLD_MS,
      `LoadShipment sync took ${syncDuration.toFixed(2)}ms (SLA: < ${SLA_THRESHOLD_MS}ms)`
    );
  });

  await t.test('TemperatureSpike immediately updates ShipmentReadModel within 200ms', async () => {
    const shipmentId = 'SYNC-TEST-001';
    const startTime = performance.now();

    await handleTemperatureSpike({
      shipmentId,
      temperature: 15.4,
      threshold: 8.0,
      sensorId: 'SENSOR-IOT-99'
    });

    const readModel = await worker.waitForVersion(shipmentId, 3, SLA_THRESHOLD_MS);
    const syncDuration = performance.now() - startTime;

    assert.ok(readModel);
    assert.strictEqual(readModel.status, 'TEMPERATURE_SPIKE');
    assert.strictEqual(readModel.temperature, 15.4);
    assert.strictEqual(readModel.lastAppliedVersion, 3);
    assert.ok(
      syncDuration < SLA_THRESHOLD_MS,
      `TemperatureSpike sync took ${syncDuration.toFixed(2)}ms (SLA: < ${SLA_THRESHOLD_MS}ms)`
    );
  });

  await t.test('ArriveAtPort immediately updates ShipmentReadModel within 200ms', async () => {
    const shipmentId = 'SYNC-TEST-001';
    const startTime = performance.now();

    await handleArriveAtPort({
      shipmentId,
      port: 'Rotterdam Maasvlakte Quay 3'
    });

    const readModel = await worker.waitForVersion(shipmentId, 4, SLA_THRESHOLD_MS);
    const syncDuration = performance.now() - startTime;

    assert.ok(readModel);
    assert.strictEqual(readModel.status, 'ARRIVED');
    assert.strictEqual(readModel.currentLocation, 'Rotterdam Maasvlakte Quay 3');
    assert.strictEqual(readModel.lastAppliedVersion, 4);
    assert.ok(
      syncDuration < SLA_THRESHOLD_MS,
      `ArriveAtPort sync took ${syncDuration.toFixed(2)}ms (SLA: < ${SLA_THRESHOLD_MS}ms)`
    );
  });
});

test('Worker Real-Time Sync — Fast O(1) Query Immediate Read Model Availability', async (t) => {
  const harness = setupHarness();
  const worker = new ProjectionWorker({ autoPoll: false });
  worker.attachHook();

  t.after(() => {
    worker.stop();
    harness.teardown();
  });

  await t.test('getShipmentState returns _source: "read_model" with zero replay delay', async () => {
    const shipmentId = 'QUERY-SYNC-01';

    await handleCreateShipment({
      shipmentId,
      origin: 'Port of Tokyo',
      destination: 'Port of Hamburg',
      cargo: 'High-Precision Robotics'
    });

    await worker.waitForVersion(shipmentId, 1, SLA_THRESHOLD_MS);

    const queryStart = performance.now();
    const queryResult = await getShipmentState(shipmentId);
    const queryLatency = performance.now() - queryStart;

    assert.ok(queryResult);
    assert.strictEqual(queryResult._source, 'read_model');
    assert.strictEqual(queryResult.shipmentId, shipmentId);
    assert.strictEqual(queryResult.status, 'CREATED');
    assert.strictEqual(queryResult.version, 1);
    assert.strictEqual(queryResult.cargo, 'High-Precision Robotics');
    assert.ok(
      queryLatency < 10,
      `Read model lookup took ${queryLatency.toFixed(3)}ms (must be < 10ms)`
    );
  });

  await t.test('listShipments includes the newly created shipment immediately', async () => {
    const list = await listShipments();
    const found = list.find((s) => s.shipmentId === 'QUERY-SYNC-01');

    assert.ok(found, 'New shipment must immediately appear in listShipments read model');
    assert.strictEqual(found._source, 'read_model');
    assert.strictEqual(found.status, 'CREATED');
  });
});

test('Worker Real-Time Sync — Rapid High-Throughput Burst SLA Conformance', async (t) => {
  const harness = setupHarness();
  const worker = new ProjectionWorker({ autoPoll: false });
  worker.attachHook();

  t.after(() => {
    worker.stop();
    harness.teardown();
  });

  await t.test('dispatches 20 rapid lifecycle commands and ensures 100% meet < 200ms SLA', async () => {
    const NUM_SHIPMENTS = 5;
    const latencies = [];

    for (let i = 1; i <= NUM_SHIPMENTS; i++) {
      const id = `BURST-SHIPMENT-${String(i).padStart(3, '0')}`;

      let t0 = performance.now();
      await handleCreateShipment({
        shipmentId: id,
        origin: 'Busan Terminal',
        destination: 'Long Beach Pier J',
        cargo: `Semiconductor Batch #${i}`
      });
      await worker.waitForVersion(id, 1, SLA_THRESHOLD_MS);
      latencies.push(performance.now() - t0);

      t0 = performance.now();
      await handleLoadShipment({
        shipmentId: id,
        vessel: `Pacific Trader #${i}`,
        port: 'Busan Terminal'
      });
      await worker.waitForVersion(id, 2, SLA_THRESHOLD_MS);
      latencies.push(performance.now() - t0);

      t0 = performance.now();
      await handleTemperatureSpike({
        shipmentId: id,
        temperature: -14.2 + i,
        threshold: -18.0,
        sensorId: `SENS-${i}`
      });
      await worker.waitForVersion(id, 3, SLA_THRESHOLD_MS);
      latencies.push(performance.now() - t0);

      t0 = performance.now();
      await handleArriveAtPort({
        shipmentId: id,
        port: 'Long Beach Pier J'
      });
      await worker.waitForVersion(id, 4, SLA_THRESHOLD_MS);
      latencies.push(performance.now() - t0);
    }

    assert.strictEqual(latencies.length, 20, 'Must record 20 distinct command-to-projection latencies');

    latencies.sort((a, b) => a - b);
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const mean = sum / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    assert.ok(max < SLA_THRESHOLD_MS, `Max latency ${max.toFixed(2)}ms breached ${SLA_THRESHOLD_MS}ms SLA`);
    assert.ok(p95 < SLA_THRESHOLD_MS, `P95 latency ${p95.toFixed(2)}ms breached ${SLA_THRESHOLD_MS}ms SLA`);
    assert.ok(mean < 50, `Mean latency ${mean.toFixed(2)}ms is exceptionally low (< 50ms)`);

    for (let i = 1; i <= NUM_SHIPMENTS; i++) {
      const id = `BURST-SHIPMENT-${String(i).padStart(3, '0')}`;
      const state = await getShipmentState(id);
      assert.strictEqual(state.version, 4);
      assert.strictEqual(state.status, 'ARRIVED');
      assert.strictEqual(state._source, 'read_model');
    }
  });
});

test('Worker Real-Time Sync — Push Hook vs Pull Polling Resiliency', async (t) => {
  const harness = setupHarness();
  const worker = new ProjectionWorker({ autoPoll: false });

  t.after(() => {
    worker.stop();
    harness.teardown();
  });

  await t.test('catches up pending events via pollOnce() when hook is temporarily detached', async () => {
    const shipmentId = 'CATCHUP-RECOVER-01';

    worker.detachHook();

    await handleCreateShipment({
      shipmentId,
      origin: 'Dubai Port',
      destination: 'Singapore Port',
      cargo: 'Specialty Minerals'
    });

    await handleLoadShipment({
      shipmentId,
      vessel: 'Arabian Gulf',
      port: 'Dubai Port'
    });

    let prematureDoc = harness.readModelStore.get(shipmentId);
    assert.strictEqual(prematureDoc, undefined, 'Read model should not exist yet without active hook or poll');

    const pollResult = await worker.pollOnce();

    assert.strictEqual(pollResult.status, 'success');
    assert.strictEqual(pollResult.processedCount, 2);

    const recoveredDoc = harness.readModelStore.get(shipmentId);
    assert.ok(recoveredDoc);
    assert.strictEqual(recoveredDoc.status, 'LOADED');
    assert.strictEqual(recoveredDoc.vessel, 'Arabian Gulf');
    assert.strictEqual(recoveredDoc.lastAppliedVersion, 2);
  });
});

test('Worker Real-Time Sync — Observability & Timeout SLA Safety', async (t) => {
  const harness = setupHarness();
  const worker = new ProjectionWorker({ autoPoll: false });
  worker.attachHook();

  t.after(() => {
    worker.stop();
    harness.teardown();
  });

  await t.test('emits eventProjected with durationMs and source: "hook"', async () => {
    const shipmentId = 'OBSERVE-01';

    const projectedPromise = new Promise((resolve) => {
      worker.once('eventProjected', resolve);
    });

    await handleCreateShipment({
      shipmentId,
      origin: 'Santos Port',
      destination: 'Rotterdam',
      cargo: 'Coffee Beans'
    });

    const emittedPayload = await projectedPromise;

    assert.ok(emittedPayload, 'Worker must emit eventProjected event');
    assert.strictEqual(emittedPayload.source, 'hook');
    assert.strictEqual(emittedPayload.event.aggregateId, shipmentId);
    assert.strictEqual(emittedPayload.event.version, 1);
    assert.strictEqual(typeof emittedPayload.durationMs, 'number');
    assert.ok(emittedPayload.durationMs >= 0);
  });

  await t.test('waitForVersion throws descriptive SLA breach error when timeout expires', async () => {
    const unproducedShipmentId = 'NON-EXISTENT-SHIPMENT';

    await assert.rejects(
      async () => {

        await worker.waitForVersion(unproducedShipmentId, 99, 30);
      },
      (err) => {
        assert.strictEqual(err.code, 'SYNC_TIMEOUT_SLA_BREACH');
        assert.ok(err.message.includes('Real-time sync SLA breached'));
        assert.strictEqual(err.timeoutMs, 30);
        return true;
      }
    );
  });
});
