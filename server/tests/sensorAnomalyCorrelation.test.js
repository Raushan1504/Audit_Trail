const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const eventStore = require('../src/events/eventStore');
const queryService = require('../src/queries/queryService');

describe('Day 25: Person 2 Backend - Correlate Sensor Anomalies with Historical Events', () => {
  const shipmentId = 'SHIP-DAY25-CORRELATE-01';

  beforeEach(async () => {
    // Populate in-memory / mock events for test
    const mockEvents = [
      {
        aggregateId: shipmentId,
        version: 1,
        eventType: 'CONTAINER_CREATED',
        timestamp: new Date('2026-10-01T10:00:00Z'),
        payload: {
          cargo: 'Frozen Atlantic Salmon',
          origin: 'Port of Oslo',
          destination: 'Port of Tokyo',
          temperature: -22.0,
          threshold: -18.0
        }
      },
      {
        aggregateId: shipmentId,
        version: 2,
        eventType: 'LOADED_ON_SHIP',
        timestamp: new Date('2026-10-01T14:30:00Z'),
        payload: {
          vessel: 'Arctic Frost',
          port: 'Port of Oslo',
          temperature: -20.5,
          threshold: -18.0,
          batteryVoltage: 3.8
        }
      },
      {
        aggregateId: shipmentId,
        version: 3,
        eventType: 'TEMPERATURE_SPIKE',
        timestamp: new Date('2026-10-02T04:15:00Z'),
        payload: {
          temperature: -11.2,
          threshold: -18.0,
          humidity: 78.0,
          batteryVoltage: 3.65,
          sensorId: 'SENSOR-REEFER-09'
        }
      },
      {
        aggregateId: shipmentId,
        version: 4,
        eventType: 'ARRIVED_AT_PORT',
        timestamp: new Date('2026-10-03T09:00:00Z'),
        payload: {
          port: 'Port of Tokyo',
          temperature: -19.0,
          threshold: -18.0,
          batteryVoltage: 3.55
        }
      }
    ];

    eventStore.getEventsByAggregateId = async (id) => {
      if (id === shipmentId) return mockEvents;
      return [];
    };
  });

  test('correlates sensor telemetry with historical domain events and coincidence metadata', async () => {
    const telemetry = await queryService.getShipmentTelemetry(shipmentId);

    assert.ok(telemetry);
    assert.equal(telemetry.shipmentId, shipmentId);
    assert.equal(telemetry.cargoProfile, 'FROZEN');
    assert.equal(telemetry.totalDataPoints, 4);

    const spikePoint = telemetry.timeSeries.find((p) => p.version === 3);
    assert.ok(spikePoint);
    assert.equal(spikePoint.isAnomaly, true);
    assert.equal(spikePoint.severity, 'CRITICAL');
    assert.equal(spikePoint.coincidence.eventType, 'TEMPERATURE_SPIKE');
    assert.equal(spikePoint.coincidence.version, 3);
    assert.match(spikePoint.coincidence.description, /TEMPERATURE_SPIKE/);
  });

  test('filters telemetry by anomaliesOnly to highlight coincided breach points', async () => {
    const anomaliesOnly = await queryService.getShipmentTelemetry(shipmentId, { anomaliesOnly: true });

    assert.ok(anomaliesOnly);
    assert.equal(anomaliesOnly.timeSeries.length, 1);
    assert.equal(anomaliesOnly.timeSeries[0].version, 3);
    assert.equal(anomaliesOnly.timeSeries[0].eventType, 'TEMPERATURE_SPIKE');
    assert.equal(anomaliesOnly.timeSeries[0].temperature, -11.2);
  });

  test('getCorrelatedAnomalies returns structured anomaly catalog with severity counts', async () => {
    const catalog = await queryService.getCorrelatedAnomalies(shipmentId);

    assert.ok(catalog);
    assert.equal(catalog.shipmentId, shipmentId);
    assert.equal(catalog.cargoProfile, 'FROZEN');
    assert.equal(catalog.totalAnomalies, 1);
    assert.equal(catalog.criticalCount, 1);
    assert.equal(catalog.warningCount, 0);
    assert.equal(catalog.anomalies[0].version, 3);
    assert.ok(catalog.anomalies[0].breaches.length > 0);
  });

  test('filters by severity level (CRITICAL vs WARNING)', async () => {
    const criticalOnly = await queryService.getShipmentTelemetry(shipmentId, {
      anomaliesOnly: true,
      severity: 'CRITICAL'
    });
    assert.equal(criticalOnly.timeSeries.length, 1);

    const warningOnly = await queryService.getShipmentTelemetry(shipmentId, {
      anomaliesOnly: true,
      severity: 'WARNING'
    });
    assert.equal(warningOnly.timeSeries.length, 0);
  });
});
