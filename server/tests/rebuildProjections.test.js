const test = require('node:test');
const assert = require('node:assert');

const Event = require('../src/models/Event');
const ShipmentReadModel = require('../src/models/ShipmentReadModel');
const { EVENT_TYPES } = require('../src/events/eventTypes');
const {
  rebuildShipmentReadModel,
  rebuildAllReadModels
} = require('../src/projections/shipmentProjection');
const { parseArgs } = require('../scripts/rebuildProjections');

test('Projection Rebuild - parseArgs CLI Option Parser', async (t) => {
  await t.test('parses default options with no arguments', () => {
    const opts = parseArgs([]);
    assert.strictEqual(opts.clean, false);
    assert.strictEqual(opts.shipmentId, null);
    assert.strictEqual(opts.dryRun, false);
    assert.strictEqual(opts.help, false);
  });

  await t.test('parses --clean and --reset flags', () => {
    assert.strictEqual(parseArgs(['--clean']).clean, true);
    assert.strictEqual(parseArgs(['--reset']).clean, true);
  });

  await t.test('parses --dry-run and -n flags', () => {
    assert.strictEqual(parseArgs(['--dry-run']).dryRun, true);
    assert.strictEqual(parseArgs(['-n']).dryRun, true);
  });

  await t.test('parses --shipment=ID and positional shipment argument', () => {
    assert.strictEqual(parseArgs(['--shipment=SHIP-100']).shipmentId, 'SHIP-100');
    assert.strictEqual(parseArgs(['--shipmentId=SHIP-200']).shipmentId, 'SHIP-200');
    assert.strictEqual(parseArgs(['SHIP-300']).shipmentId, 'SHIP-300');
  });

  await t.test('parses --help and -h flags', () => {
    assert.strictEqual(parseArgs(['--help']).help, true);
    assert.strictEqual(parseArgs(['-h']).help, true);
  });
});

test('Projection Rebuild - rebuildShipmentReadModel Core Logic', async (t) => {
  let readModelStore = new Map();

  const originalFind = Event.find;
  const originalFindOne = ShipmentReadModel.findOne;
  const originalSave = ShipmentReadModel.prototype.save;

  t.beforeEach(() => {
    readModelStore.clear();

    ShipmentReadModel.findOne = async function (query) {
      const doc = readModelStore.get(query.shipmentId);
      if (!doc) return null;
      return {
        ...doc,
        save: async function () {
          readModelStore.set(this.shipmentId, { ...this });
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
        cargo: this.cargo
      };
      readModelStore.set(this.shipmentId, data);
      return data;
    };
  });

  t.afterEach(() => {
    Event.find = originalFind;
    ShipmentReadModel.findOne = originalFindOne;
    ShipmentReadModel.prototype.save = originalSave;
  });

  await t.test('throws an error if shipmentId is missing', async () => {
    await assert.rejects(
      () => rebuildShipmentReadModel(null),
      /shipmentId is required/
    );
  });

  await t.test('returns null if aggregate has no events in the Event Store', async () => {
    Event.find = () => ({
      sort: () => []
    });

    const res = await rebuildShipmentReadModel('NON-EXISTENT');
    assert.strictEqual(res, null);
  });

  await t.test('replays full event history and creates new read model if not previously projected', async () => {
    const events = [
      {
        aggregateId: 'SHP-NEW-01',
        eventType: EVENT_TYPES.CONTAINER_CREATED,
        version: 1,
        timestamp: new Date('2026-08-01T10:00:00Z'),
        payload: { origin: 'Port of Tokyo', cargo: 'Semiconductors' }
      },
      {
        aggregateId: 'SHP-NEW-01',
        eventType: EVENT_TYPES.LOADED_ON_SHIP,
        version: 2,
        timestamp: new Date('2026-08-01T14:00:00Z'),
        payload: { port: 'Tokyo Bay Berth 2', vessel: 'MV NIPPON' }
      }
    ];

    Event.find = () => ({
      sort: () => events
    });

    const result = await rebuildShipmentReadModel('SHP-NEW-01');

    assert.ok(result);
    assert.strictEqual(result.shipmentId, 'SHP-NEW-01');
    assert.strictEqual(result.status, 'LOADED');
    assert.strictEqual(result.lastAppliedVersion, 2);
    assert.strictEqual(result.currentLocation, 'Tokyo Bay Berth 2');
    assert.strictEqual(result.vessel, 'MV NIPPON');
    assert.strictEqual(result.cargo, 'Semiconductors');
  });

  await t.test('overwrites and corrects out-of-sync existing read model with full canonical replay', async () => {

    readModelStore.set('SHP-STALE-01', {
      shipmentId: 'SHP-STALE-01',
      status: 'CREATED',
      currentLocation: 'Old Origin',
      lastAppliedVersion: 1
    });

    const canonicalEvents = [
      {
        aggregateId: 'SHP-STALE-01',
        eventType: EVENT_TYPES.CONTAINER_CREATED,
        version: 1,
        timestamp: new Date('2026-08-01T10:00:00Z'),
        payload: { origin: 'Port of Rotterdam', cargo: 'Dry Bulk' }
      },
      {
        aggregateId: 'SHP-STALE-01',
        eventType: EVENT_TYPES.LOADED_ON_SHIP,
        version: 2,
        timestamp: new Date('2026-08-01T12:00:00Z'),
        payload: { port: 'Rotterdam Terminal', vessel: 'MV EUROPA' }
      },
      {
        aggregateId: 'SHP-STALE-01',
        eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
        version: 3,
        timestamp: new Date('2026-08-01T16:00:00Z'),
        payload: { temperature: 24.2 }
      },
      {
        aggregateId: 'SHP-STALE-01',
        eventType: EVENT_TYPES.ARRIVED_AT_PORT,
        version: 4,
        timestamp: new Date('2026-08-02T10:00:00Z'),
        payload: { port: 'Port of New York' }
      }
    ];

    Event.find = () => ({
      sort: () => canonicalEvents
    });

    const updated = await rebuildShipmentReadModel('SHP-STALE-01');

    assert.strictEqual(updated.shipmentId, 'SHP-STALE-01');
    assert.strictEqual(updated.status, 'ARRIVED');
    assert.strictEqual(updated.lastAppliedVersion, 4);
    assert.strictEqual(updated.currentLocation, 'Port of New York');
    assert.strictEqual(updated.temperature, 24.2);
    assert.strictEqual(updated.vessel, 'MV EUROPA');
  });
});

test('Projection Rebuild - rebuildAllReadModels Batch and Options', async (t) => {
  let readModelStore = new Map();
  let deletedMany = false;

  const originalFind = Event.find;
  const originalDistinct = Event.distinct;
  const originalFindOne = ShipmentReadModel.findOne;
  const originalDeleteMany = ShipmentReadModel.deleteMany;
  const originalSave = ShipmentReadModel.prototype.save;

  t.beforeEach(() => {
    readModelStore.clear();
    deletedMany = false;

    Event.distinct = async () => ['SHP-A', 'SHP-B'];

    Event.find = (query) => ({
      sort: () => {
        if (query.aggregateId === 'SHP-A') {
          return [
            {
              aggregateId: 'SHP-A',
              eventType: EVENT_TYPES.CONTAINER_CREATED,
              version: 1,
              payload: { origin: 'Port A', cargo: 'Goods A' }
            }
          ];
        }
        if (query.aggregateId === 'SHP-B') {
          return [
            {
              aggregateId: 'SHP-B',
              eventType: EVENT_TYPES.CONTAINER_CREATED,
              version: 1,
              payload: { origin: 'Port B', cargo: 'Goods B' }
            },
            {
              aggregateId: 'SHP-B',
              eventType: EVENT_TYPES.LOADED_ON_SHIP,
              version: 2,
              payload: { port: 'Port B Pier 1', vessel: 'Ship B' }
            }
          ];
        }
        return [];
      }
    });

    ShipmentReadModel.findOne = async (query) => {
      const doc = readModelStore.get(query.shipmentId);
      if (!doc) return null;
      return {
        ...doc,
        save: async function () {
          readModelStore.set(this.shipmentId, { ...this });
          return this;
        }
      };
    };

    ShipmentReadModel.deleteMany = async () => {
      deletedMany = true;
      readModelStore.clear();
      return { acknowledged: true, deletedCount: 2 };
    };

    ShipmentReadModel.prototype.save = async function () {
      const data = {
        shipmentId: this.shipmentId,
        status: this.status,
        currentLocation: this.currentLocation,
        lastAppliedVersion: this.lastAppliedVersion
      };
      readModelStore.set(this.shipmentId, data);
      return data;
    };
  });

  t.afterEach(() => {
    Event.find = originalFind;
    Event.distinct = originalDistinct;
    ShipmentReadModel.findOne = originalFindOne;
    ShipmentReadModel.deleteMany = originalDeleteMany;
    ShipmentReadModel.prototype.save = originalSave;
  });

  await t.test('rebuilds all shipments present in Event Store', async () => {
    const summary = await rebuildAllReadModels();

    assert.strictEqual(summary.totalShipments, 2);
    assert.strictEqual(summary.rebuiltCount, 2);
    assert.strictEqual(summary.totalEventsReplayed, 3);
    assert.strictEqual(deletedMany, false);
    assert.strictEqual(readModelStore.get('SHP-A').lastAppliedVersion, 1);
    assert.strictEqual(readModelStore.get('SHP-B').lastAppliedVersion, 2);
  });

  await t.test('supports clean wipe option before rebuild', async () => {
    const summary = await rebuildAllReadModels({ clean: true });

    assert.strictEqual(deletedMany, true);
    assert.strictEqual(summary.rebuiltCount, 2);
    assert.strictEqual(readModelStore.size, 2);
  });

  await t.test('filters and rebuilds only a single specified shipment', async () => {
    const summary = await rebuildAllReadModels({ shipmentId: 'SHP-B' });

    assert.strictEqual(summary.totalShipments, 1);
    assert.strictEqual(summary.rebuiltCount, 1);
    assert.strictEqual(summary.totalEventsReplayed, 2);
    assert.strictEqual(readModelStore.get('SHP-B').status, 'LOADED');
    assert.strictEqual(readModelStore.has('SHP-A'), false);
  });

  await t.test('supports dryRun mode without modifying readModelStore or calling deleteMany', async () => {
    const summary = await rebuildAllReadModels({ clean: true, dryRun: true });

    assert.strictEqual(deletedMany, false, 'deleteMany must not be called during dryRun');
    assert.strictEqual(summary.rebuiltCount, 2);
    assert.strictEqual(summary.totalEventsReplayed, 3);
    assert.strictEqual(readModelStore.size, 0, 'No read models should be written during dryRun');
    assert.strictEqual(summary.shipments[0].shipmentId, 'SHP-A');
    assert.strictEqual(summary.shipments[1].shipmentId, 'SHP-B');
  });
});
