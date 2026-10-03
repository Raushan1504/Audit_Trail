import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  findEventByVersion,
  isCorrelatedAnomaly,
  getTelemetrySyncBadgeMeta
} from '../src/utils/telemetrySync.js';

describe('Day 25: Person 3 React - Synchronize Recharts Hover Tooltip with Timeline Cards', () => {
  const mockEvents = [
    {
      version: 1,
      eventType: 'CONTAINER_CREATED',
      payload: { cargo: 'Frozen Vaccines', origin: 'Berlin', destination: 'Tokyo' }
    },
    {
      version: 2,
      eventType: 'LOADED_ON_SHIP',
      payload: { vessel: 'Nordic Explorer', port: 'Hamburg' }
    },
    {
      version: 3,
      eventType: 'TEMPERATURE_SPIKE',
      payload: { temperature: 11.4, threshold: 4.0, humidity: 76.0 }
    },
    {
      version: 4,
      eventType: 'ARRIVED_AT_PORT',
      payload: { port: 'Tokyo' }
    }
  ];

  describe('findEventByVersion', () => {
    test('locates exact domain event by version number', () => {
      const event = findEventByVersion(mockEvents, 3);
      assert.ok(event);
      assert.equal(event.version, 3);
      assert.equal(event.eventType, 'TEMPERATURE_SPIKE');
    });

    test('locates domain event when target is a telemetry data point object', () => {
      const telemetryPoint = { version: 2, temperature: 3.8, shortName: 'v2' };
      const event = findEventByVersion(mockEvents, telemetryPoint);
      assert.ok(event);
      assert.equal(event.version, 2);
      assert.equal(event.eventType, 'LOADED_ON_SHIP');
    });

    test('returns null gracefully for non-existent versions or empty inputs', () => {
      assert.equal(findEventByVersion(mockEvents, 999), null);
      assert.equal(findEventByVersion([], 1), null);
      assert.equal(findEventByVersion(null, 1), null);
      assert.equal(findEventByVersion(mockEvents, null), null);
    });
  });

  describe('isCorrelatedAnomaly', () => {
    test('identifies TEMPERATURE_SPIKE event as correlated anomaly', () => {
      const spikeEvent = mockEvents[2];
      const point = { version: 3, temperature: 11.4, threshold: 4.0, isAnomaly: true };
      assert.equal(isCorrelatedAnomaly(spikeEvent, point), true);
    });

    test('identifies temperature breach even if event is not named TEMPERATURE_SPIKE', () => {
      const normalEvent = mockEvents[1];
      const breachPoint = { version: 2, temperature: 9.0, threshold: 4.0 };
      assert.equal(isCorrelatedAnomaly(normalEvent, breachPoint), true);
    });

    test('returns false for nominal events and readings', () => {
      const normalEvent = mockEvents[0];
      const safePoint = { version: 1, temperature: 3.2, threshold: 4.0, isAnomaly: false };
      assert.equal(isCorrelatedAnomaly(normalEvent, safePoint), false);
    });
  });

  describe('getTelemetrySyncBadgeMeta', () => {
    test('generates critical badge metadata for thermal spike anomalies', () => {
      const point = { version: 3, temperature: 12.0, threshold: 4.0, isAnomaly: true };
      const meta = getTelemetrySyncBadgeMeta(point);

      assert.equal(meta.isAnomaly, true);
      assert.equal(meta.variant, 'critical');
      assert.match(meta.label, /THERMAL SPIKE/);
      assert.match(meta.label, /\+8\.0°C/);
    });

    test('generates warning badge metadata for elevated humidity', () => {
      const point = { version: 2, temperature: 3.5, threshold: 4.0, humidity: 88, isAnomaly: false };
      const meta = getTelemetrySyncBadgeMeta(point);

      assert.equal(meta.isAnomaly, true);
      assert.equal(meta.variant, 'warning');
      assert.match(meta.label, /HIGH HUMIDITY/);
    });

    test('generates standard synchronized badge for nominal data points', () => {
      const point = { version: 1, temperature: 3.5, threshold: 4.0, isAnomaly: false };
      const meta = getTelemetrySyncBadgeMeta(point);

      assert.equal(meta.isAnomaly, false);
      assert.equal(meta.variant, 'synced');
      assert.equal(meta.label, '📡 TELEMETRY v1');
    });

    test('handles null point safely', () => {
      const meta = getTelemetrySyncBadgeMeta(null);
      assert.equal(meta.isAnomaly, false);
      assert.equal(meta.label, 'SYNCHRONIZED');
    });
  });
});
