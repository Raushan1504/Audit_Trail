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
const { reconstructShipmentState } = require('../src/domain/shipmentReconstruction');

test('shipmentProjection - pure projectEvent transformer', async (t) => {
  await t.test('throws error if event is missing or invalid', () => {
    assert.throws(
      () => projectEvent(null, null),
      /event is required/
    );

    assert.throws(
      () => projectEvent(null, {}),
      /eventType is required/
    );

    assert.throws(
      () =>
        projectEvent(null, {
          eventType: EVENT_TYPES.CONTAINER_CREATED
        }),
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

    // Day 24 telemetry fields start empty.
    assert.strictEqual(state.humidity, null);
    assert.strictEqual(state.batteryVoltage, null);
    assert.strictEqual(state.ambientTemp, null);
    assert.strictEqual(state.coordinates, null);

    assert.strictEqual(state.vessel, null);
    assert.strictEqual(state.lastAppliedVersion, 1);

    assert.strictEqual(
      state.lastEventTimestamp.toISOString(),
      '2026-09-01T10:00:00.000Z'
    );
  });

  await t.test(
    'projects CONTAINER_CREATED with object cargo correctly by normalizing to string',
    () => {
      const event = {
        aggregateId: 'SHP-OBJ-01',
        eventType: EVENT_TYPES.CONTAINER_CREATED,
        version: 1,
        payload: {
          origin: 'Port of Dubai',
          destination: 'Port of Rotterdam',
          cargo: {
            description: 'Dry Goods'
          }
        },
        timestamp: new Date('2026-09-01T10:00:00Z')
      };

      const state = projectEvent(null, event);

      assert.strictEqual(state.shipmentId, 'SHP-OBJ-01');
      assert.strictEqual(state.cargo, 'Dry Goods');
    }
  );

  await t.test(
    'projects LOADED_ON_SHIP into LOADED status with vessel and location',
    () => {
      const priorState = {
        shipmentId: 'SHP-001',
        status: 'CREATED',
        currentLocation: 'Port of Singapore',
        cargo: 'Electronics & Semiconductors',
        temperature: null,
        humidity: null,
        batteryVoltage: null,
        ambientTemp: null,
        coordinates: null,
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
      assert.strictEqual(
        nextState.currentLocation,
        'Port of Singapore Berth 4'
      );
      assert.strictEqual(
        nextState.cargo,
        'Electronics & Semiconductors'
      );
      assert.strictEqual(nextState.lastAppliedVersion, 2);

      assert.strictEqual(
        nextState.lastEventTimestamp.toISOString(),
        '2026-09-02T12:00:00.000Z'
      );
    }
  );

  await t.test(
    'projects TEMPERATURE_SPIKE with telemetry update while preserving logistics fields',
    () => {
      const priorState = {
        shipmentId: 'SHP-001',
        status: 'LOADED',
        currentLocation: 'Indian Ocean',
        cargo: 'Pharmaceutical Vaccines',
        temperature: 4.0,
        humidity: 65.0,
        batteryVoltage: 3.85,
        ambientTemp: 25.0,
        coordinates: {
          lat: 18.5204,
          lng: 73.8567
        },
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
          sensorId: 'SENSOR-TEMP-09',
          humidity: 72.5,
          batteryVoltage: 3.78,
          ambientTemp: 26.4,
          coordinates: {
            lat: 19.0760,
            lng: 72.8777
          }
        },
        timestamp: new Date('2026-09-03T16:30:00Z')
      };

      const nextState = projectEvent(priorState, event);

      assert.strictEqual(nextState.shipmentId, 'SHP-001');
      assert.strictEqual(
        nextState.status,
        'TEMPERATURE_SPIKE'
      );

      assert.strictEqual(nextState.temperature, 14.8);
      assert.strictEqual(nextState.humidity, 72.5);
      assert.strictEqual(nextState.batteryVoltage, 3.78);
      assert.strictEqual(nextState.ambientTemp, 26.4);

      assert.deepStrictEqual(
        nextState.coordinates,
        {
          lat: 19.0760,
          lng: 72.8777
        }
      );

      assert.strictEqual(
        nextState.currentLocation,
        'Indian Ocean'
      );
      assert.strictEqual(
        nextState.vessel,
        'MV Oceania Trader'
      );
      assert.strictEqual(
        nextState.cargo,
        'Pharmaceutical Vaccines'
      );
      assert.strictEqual(
        nextState.lastAppliedVersion,
        3
      );
    }
  );

  await t.test(
    'projects TEMPERATURE_SPIKE GPS data from gps fallback field',
    () => {
      const priorState = {
        shipmentId: 'SHP-GPS-001',
        status: 'LOADED',
        currentLocation: 'Arabian Sea',
        cargo: 'Medical Supplies',
        temperature: 4.0,
        vessel: 'MV Telemetry',
        lastAppliedVersion: 2
      };

      const event = {
        aggregateId: 'SHP-GPS-001',
        eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
        version: 3,
        payload: {
          temperature: 11.7,
          humidity: 68.0,
          batteryVoltage: 3.81,
          ambientTemp: 27.1,
          gps: {
            lat: 18.9388,
            lng: 72.8354
          }
        },
        timestamp: new Date('2026-09-03T17:00:00Z')
      };

      const nextState = projectEvent(priorState, event);

      assert.deepStrictEqual(
        nextState.coordinates,
        {
          lat: 18.9388,
          lng: 72.8354
        }
      );

      assert.strictEqual(nextState.humidity, 68.0);
      assert.strictEqual(nextState.batteryVoltage, 3.81);
      assert.strictEqual(nextState.ambientTemp, 27.1);
    }
  );

  await t.test(
    'projects ARRIVED_AT_PORT into terminal ARRIVED status',
    () => {
      const priorState = {
        shipmentId: 'SHP-001',
        status: 'TEMPERATURE_SPIKE',
        currentLocation: 'North Sea',
        cargo: 'Pharmaceutical Vaccines',
        temperature: 14.8,
        humidity: 72.5,
        batteryVoltage: 3.78,
        ambientTemp: 26.4,
        coordinates: {
          lat: 19.0760,
          lng: 72.8777
        },
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
      assert.strictEqual(
        nextState.currentLocation,
        'Port of Rotterdam Terminals'
      );

      // Telemetry must survive later lifecycle events.
      assert.strictEqual(nextState.temperature, 14.8);
      assert.strictEqual(nextState.humidity, 72.5);
      assert.strictEqual(nextState.batteryVoltage, 3.78);
      assert.strictEqual(nextState.ambientTemp, 26.4);

      assert.deepStrictEqual(
        nextState.coordinates,
        {
          lat: 19.0760,
          lng: 72.8777
        }
      );

      assert.strictEqual(nextState.lastAppliedVersion, 4);
    }
  );

  await t.test(
    'throws descriptive error on unsupported event type',
    () => {
      assert.throws(
        () =>
          projectEvent(null, {
            aggregateId: 'SHP-UNKNOWN',
            eventType: 'UNKNOWN_LIFECYCLE_EVENT',
            version: 1
          }),
        /Unsupported event type: UNKNOWN_LIFECYCLE_EVENT/
      );
    }
  );
});

test(
  'shipmentProjection - applyEventToReadModel persistence & idempotency',
  async (t) => {
    // Setup in-memory mock store for ShipmentReadModel.
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

          toObject: () => ({
            ...doc
          }),

          save: async function () {
            readModelStore.set(
              doc.shipmentId,
              {
                ...this
              }
            );

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

          // Day 24 telemetry
          humidity: this.humidity,
          batteryVoltage: this.batteryVoltage,
          ambientTemp: this.ambientTemp,
          coordinates: this.coordinates,

          lastAppliedVersion: this.lastAppliedVersion,
          vessel: this.vessel,
          cargo: this.cargo,
          lastEventTimestamp: this.lastEventTimestamp
        };

        readModelStore.set(
          this.shipmentId,
          data
        );

        return {
          ...data,

          toObject: () => ({
            ...data
          }),

          save: async function () {
            readModelStore.set(
              data.shipmentId,
              {
                ...this
              }
            );

            return this;
          }
        };
      };
    });

    t.afterEach(() => {
      ShipmentReadModel.findOne = originalFindOne;
      ShipmentReadModel.prototype.save = originalSave;
    });

    await t.test(
      'creates initial read model on first event append',
      async () => {
        const event = {
          aggregateId: 'SHP-MOCK-1',
          eventType: EVENT_TYPES.CONTAINER_CREATED,
          version: 1,
          payload: {
            origin: 'Hamburg',
            cargo: 'Automotive Parts'
          },
          timestamp: new Date()
        };

        const result =
          await applyEventToReadModel(event);

        assert.strictEqual(result.applied, true);
        assert.strictEqual(result.reason, 'APPLIED');
        assert.strictEqual(result.shipmentId, 'SHP-MOCK-1');
        assert.strictEqual(result.version, 1);

        const saved =
          readModelStore.get('SHP-MOCK-1');

        assert.ok(saved);
        assert.strictEqual(saved.status, 'CREATED');
        assert.strictEqual(
          saved.cargo,
          'Automotive Parts'
        );
        assert.strictEqual(
          saved.currentLocation,
          'Hamburg'
        );

        assert.strictEqual(saved.humidity, null);
        assert.strictEqual(saved.batteryVoltage, null);
        assert.strictEqual(saved.ambientTemp, null);

        // Mongoose represents nested coordinates as a
        // subdocument even when no values are supplied.
        assert.ok(saved.coordinates);
        assert.strictEqual(
          saved.coordinates.lat,
          undefined
        );
        assert.strictEqual(
          saved.coordinates.lng,
          undefined
        );
      }
    );

    await t.test(
      'idempotency: skips already applied event versions',
      async () => {
        const eventV1 = {
          aggregateId: 'SHP-IDEMPOTENT-1',
          eventType:
            EVENT_TYPES.CONTAINER_CREATED,
          version: 1,
          payload: {
            origin: 'Tokyo',
            cargo: 'Medical Devices'
          }
        };

        await applyEventToReadModel(eventV1);

        const duplicateResult =
          await applyEventToReadModel(eventV1);

        assert.strictEqual(
          duplicateResult.applied,
          false
        );

        assert.strictEqual(
          duplicateResult.reason,
          'ALREADY_APPLIED'
        );

        assert.strictEqual(
          duplicateResult.version,
          1
        );
      }
    );

    await t.test(
      'updates existing read model document sequentially',
      async () => {
        const eventV1 = {
          aggregateId: 'SHP-SEQ-1',
          eventType:
            EVENT_TYPES.CONTAINER_CREATED,
          version: 1,
          payload: {
            origin: 'Mumbai',
            cargo: 'Spices'
          }
        };

        const eventV2 = {
          aggregateId: 'SHP-SEQ-1',
          eventType:
            EVENT_TYPES.LOADED_ON_SHIP,
          version: 2,
          payload: {
            vessel: 'INS Sagar',
            port: 'Nhava Sheva'
          }
        };

        await applyEventToReadModel(eventV1);

        const result2 =
          await applyEventToReadModel(eventV2);

        assert.strictEqual(result2.applied, true);
        assert.strictEqual(result2.version, 2);

        const saved =
          readModelStore.get('SHP-SEQ-1');

        assert.strictEqual(
          saved.status,
          'LOADED'
        );

        assert.strictEqual(
          saved.vessel,
          'INS Sagar'
        );

        assert.strictEqual(
          saved.currentLocation,
          'Nhava Sheva'
        );

        assert.strictEqual(
          saved.cargo,
          'Spices'
        );

        assert.strictEqual(
          saved.lastAppliedVersion,
          2
        );
      }
    );

    await t.test(
      'persists enriched telemetry through the read model',
      async () => {
        const eventV1 = {
          aggregateId:
            'SHP-TELEMETRY-001',
          eventType:
            EVENT_TYPES.CONTAINER_CREATED,
          version: 1,
          payload: {
            origin: 'Mumbai',
            cargo: 'Vaccines'
          }
        };

        const eventV2 = {
          aggregateId:
            'SHP-TELEMETRY-001',
          eventType:
            EVENT_TYPES.LOADED_ON_SHIP,
          version: 2,
          payload: {
            vessel: 'MV-AUDIT-24',
            port: 'Mumbai Port'
          }
        };

        const eventV3 = {
          aggregateId:
            'SHP-TELEMETRY-001',
          eventType:
            EVENT_TYPES.TEMPERATURE_SPIKE,
          version: 3,
          payload: {
            temperature: 16.5,
            threshold: 4.0,
            sensorId: 'SENSOR-IOT-24',
            humidity: 78.2,
            batteryVoltage: 3.78,
            ambientTemp: 28.4,
            coordinates: {
              lat: 19.0760,
              lng: 72.8777
            }
          }
        };

        await applyEventToReadModel(eventV1);
        await applyEventToReadModel(eventV2);

        const result =
          await applyEventToReadModel(eventV3);

        assert.strictEqual(result.applied, true);
        assert.strictEqual(result.version, 3);

        const saved =
          readModelStore.get(
            'SHP-TELEMETRY-001'
          );

        assert.ok(saved);

        assert.strictEqual(
          saved.temperature,
          16.5
        );

        assert.strictEqual(
          saved.humidity,
          78.2
        );

        assert.strictEqual(
          saved.batteryVoltage,
          3.78
        );

        assert.strictEqual(
          saved.ambientTemp,
          28.4
        );

        assert.deepStrictEqual(
          saved.coordinates,
          {
            lat: 19.0760,
            lng: 72.8777
          }
        );

        assert.strictEqual(
          saved.vessel,
          'MV-AUDIT-24'
        );

        assert.strictEqual(
          saved.currentLocation,
          'Mumbai Port'
        );

        assert.strictEqual(
          saved.lastAppliedVersion,
          3
        );
      }
    );

    await t.test(
      'matches full historical replay state',
      async () => {
        const shipmentId =
          'SHIP-REPLAY-001';

        const events = [
          {
            aggregateId: shipmentId,
            eventType:
              EVENT_TYPES.CONTAINER_CREATED,
            version: 1,
            timestamp:
              '2026-08-01T10:00:00.000Z',
            payload: {
              origin: 'Mumbai Port',
              cargo:
                'Pharmaceutical Vaccines'
            }
          },

          {
            aggregateId: shipmentId,
            eventType:
              EVENT_TYPES.LOADED_ON_SHIP,
            version: 2,
            timestamp:
              '2026-08-01T12:00:00.000Z',
            payload: {
              port: 'Mumbai Port',
              vessel: 'MV-AUDIT-01'
            }
          },

          {
            aggregateId: shipmentId,
            eventType:
              EVENT_TYPES.TEMPERATURE_SPIKE,
            version: 3,
            timestamp:
              '2026-08-01T15:00:00.000Z',
            payload: {
              temperature: 12,
              humidity: 76.5,
              batteryVoltage: 3.82,
              ambientTemp: 27.3,
              coordinates: {
                lat: 18.9388,
                lng: 72.8354
              }
            }
          },

          {
            aggregateId: shipmentId,
            eventType:
              EVENT_TYPES.ARRIVED_AT_PORT,
            version: 4,
            timestamp:
              '2026-08-01T18:00:00.000Z',
            payload: {
              port: 'Chennai Port'
            }
          }
        ];

        let projectedState = null;

        for (const event of events) {
          projectedState =
            projectEvent(
              projectedState,
              event
            );
        }

        const replayedState =
          reconstructShipmentState(
            shipmentId,
            events
          );

        const comparableProjectionState = {
          shipmentId:
            projectedState.shipmentId,
          status:
            projectedState.status,
          location:
            projectedState.currentLocation,
          temperature:
            projectedState.temperature,
          vessel:
            projectedState.vessel,
          version:
            projectedState.lastAppliedVersion
        };

        const comparableReplayedState = {
          shipmentId:
            replayedState.shipmentId,
          status:
            replayedState.status,
          location:
            replayedState.location,
          temperature:
            replayedState.temperature,
          vessel:
            replayedState.vessel,
          version:
            replayedState.version
        };

        assert.deepStrictEqual(
          comparableProjectionState,
          comparableReplayedState
        );

        assert.strictEqual(
          projectedState.humidity,
          76.5
        );

        assert.strictEqual(
          projectedState.batteryVoltage,
          3.82
        );

        assert.strictEqual(
          projectedState.ambientTemp,
          27.3
        );

        assert.deepStrictEqual(
          projectedState.coordinates,
          {
            lat: 18.9388,
            lng: 72.8354
          }
        );
      }
    );
  }
);

test(
  'Day 21 - projection consistency across all canonical event types',
  () => {
    const shipmentId =
      'SHP-CONSISTENCY-001';

    const events = [
      {
        aggregateId: shipmentId,
        eventType:
          EVENT_TYPES.CONTAINER_CREATED,
        version: 1,
        payload: {
          cargo: 'Pharmaceutical Vaccines'
        },
        timestamp:
          new Date('2026-09-01T10:00:00Z')
      },

      {
        aggregateId: shipmentId,
        eventType:
          EVENT_TYPES.LOADED_ON_SHIP,
        version: 2,
        payload: {
          port: 'Mumbai Port',
          vessel: 'MV-AUDIT-21'
        },
        timestamp:
          new Date('2026-09-01T12:00:00Z')
      },

      {
        aggregateId: shipmentId,
        eventType:
          EVENT_TYPES.TEMPERATURE_SPIKE,
        version: 3,
        payload: {
          temperature: 12.5,
          humidity: 74.2,
          batteryVoltage: 3.79,
          ambientTemp: 27.8,
          coordinates: {
            lat: 19.0760,
            lng: 72.8777
          }
        },
        timestamp:
          new Date('2026-09-01T15:00:00Z')
      },

      {
        aggregateId: shipmentId,
        eventType:
          EVENT_TYPES.ARRIVED_AT_PORT,
        version: 4,
        payload: {
          port: 'Chennai Port'
        },
        timestamp:
          new Date('2026-09-01T18:00:00Z')
      }
    ];

    let projectedState = null;

    for (const event of events) {
      projectedState =
        projectEvent(
          projectedState,
          event
        );

      const replayedState =
        reconstructShipmentState(
          shipmentId,
          events.slice(
            0,
            event.version
          )
        );

      assert.strictEqual(
        projectedState.shipmentId,
        replayedState.shipmentId
      );

      assert.strictEqual(
        projectedState.status,
        replayedState.status
      );

      assert.strictEqual(
        projectedState.currentLocation ?? null,
        replayedState.location ?? null
      );

      assert.strictEqual(
        projectedState.temperature ?? null,
        replayedState.temperature ?? null
      );

      assert.strictEqual(
        projectedState.vessel ?? null,
        replayedState.vessel ?? null
      );

      assert.strictEqual(
        projectedState.lastAppliedVersion,
        replayedState.version
      );
    }

    assert.strictEqual(
      projectedState.status,
      'ARRIVED'
    );

    assert.strictEqual(
      projectedState.currentLocation,
      'Chennai Port'
    );

    assert.strictEqual(
      projectedState.temperature,
      12.5
    );

    assert.strictEqual(
      projectedState.humidity,
      74.2
    );

    assert.strictEqual(
      projectedState.batteryVoltage,
      3.79
    );

    assert.strictEqual(
      projectedState.ambientTemp,
      27.8
    );

    assert.deepStrictEqual(
      projectedState.coordinates,
      {
        lat: 19.0760,
        lng: 72.8777
      }
    );

    assert.strictEqual(
      projectedState.vessel,
      'MV-AUDIT-21'
    );

    assert.strictEqual(
      projectedState.lastAppliedVersion,
      4
    );
  }
);