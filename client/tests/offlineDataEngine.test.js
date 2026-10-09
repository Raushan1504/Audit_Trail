import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getOfflineEvents,
  getOfflineState,
  getOfflineStateAsOf,
  getOfflineTelemetry,
  applyOfflineCommand,
  foldEvents
} from '../src/utils/offlineDataEngine.js';

describe('Resilient Offline Data Engine', () => {
  describe('Canonical Scenarios Retrieval', () => {
    test('retrieves full 4-event sequence for SHIP-001', () => {
      const events = getOfflineEvents('SHIP-001');
      assert.ok(Array.isArray(events));
      assert.equal(events.length, 4);
      assert.equal(events[0].eventType, 'CONTAINER_CREATED');
      assert.equal(events[1].eventType, 'LOADED_ON_SHIP');
      assert.equal(events[2].eventType, 'TEMPERATURE_SPIKE');
      assert.equal(events[3].eventType, 'ARRIVED_AT_PORT');
    });

    test('retrieves vaccine cold-chain scenario for SHIP-PHARMA-2026-EU-JP', () => {
      const events = getOfflineEvents('SHIP-PHARMA-2026-EU-JP');
      assert.ok(Array.isArray(events));
      assert.equal(events.length, 4);
      assert.equal(events[2].payload.temperature, 11.8);
      assert.equal(events[2].payload.threshold, 8.0);
    });

    test('generates dynamic deterministic events for unknown shipment IDs', () => {
      const customEvents = getOfflineEvents('SHIP-CUSTOM-999');
      assert.ok(Array.isArray(customEvents));
      assert.ok(customEvents.length >= 3);
      assert.equal(customEvents[0].aggregateId, 'SHIP-CUSTOM-999');
      assert.equal(customEvents[0].version, 1);
    });
  });

  describe('State Reconstruction via foldEvents', () => {
    test('reconstructs latest state at version 4 for SHIP-001', () => {
      const state = getOfflineState('SHIP-001');
      assert.ok(state);
      assert.equal(state.shipmentId, 'SHIP-001');
      assert.equal(state.version, 4);
      assert.equal(state.status, 'ARRIVED');
      assert.match(state.location, /Rotterdam/);
    });

    test('reconstructs point-in-time state as-of version 2', () => {
      const asOfV2 = getOfflineStateAsOf('SHIP-001', 2);
      assert.ok(asOfV2);
      assert.equal(asOfV2.version, 2);
      assert.equal(asOfV2.status, 'LOADED');
    });
  });

  describe('Telemetry Time-Series Generation', () => {
    test('generates valid time-series and summary metrics', () => {
      const telemetry = getOfflineTelemetry('SHIP-001');
      assert.ok(telemetry);
      assert.equal(telemetry.shipmentId, 'SHIP-001');
      assert.ok(Array.isArray(telemetry.timeSeries));
      assert.equal(telemetry.timeSeries.length, 4);

      assert.ok(typeof telemetry.summary.minTemp === 'number');
      assert.ok(typeof telemetry.summary.maxTemp === 'number');
      assert.ok(typeof telemetry.summary.avgTemp === 'number');
      assert.equal(telemetry.summary.anomaliesCount, 1);
    });
  });

  describe('Offline Command Execution & OCC Guards', () => {
    test('appends command event when expectedVersion matches', () => {
      const result = applyOfflineCommand('/commands/shipments/load', {
        shipmentId: 'CONT-GENESIS-99',
        expectedVersion: 1,
        vessel: 'MV PACIFIC PRIDE',
        port: 'Port of Singapore'
      });

      assert.equal(result.success, true);
      assert.equal(result.version, 2);
      assert.equal(result.event.eventType, 'LOADED_ON_SHIP');
    });

    test('throws 409 conflict when expectedVersion is stale', () => {
      assert.throws(
        () => {
          applyOfflineCommand('/commands/shipments/load', {
            shipmentId: 'SHIP-001',
            expectedVersion: 1, // SHIP-001 is already at v4
            vessel: 'Stale Vessel'
          });
        },
        (err) => {
          assert.equal(err.status, 409);
          assert.match(err.message, /OCC Concurrency Conflict/);
          return true;
        }
      );
    });
  });
});
