import test from 'node:test';
import assert from 'node:assert/strict';

test('Day 24: Recharts Sensor Telemetry Data Transformation & KPI Metrics', async (t) => {
  const mockApiTelemetry = {
    shipmentId: 'SHIP-RECHARTS-001',
    totalDataPoints: 4,
    metrics: {
      minTemperature: 3.8,
      maxTemperature: 15.6,
      avgTemperature: 6.9,
      criticalThreshold: 4.0,
      anomaliesDetected: 1,
      latestBatteryVoltage: 3.79,
      latestHumidity: 74.2
    },
    timeSeries: [
      {
        version: 1,
        eventType: 'CONTAINER_CREATED',
        timestamp: '2026-08-01T10:00:00.000Z',
        temperature: 3.8,
        threshold: 4.0,
        humidity: 52.0,
        batteryVoltage: 3.95,
        ambientTemp: 21.0,
        isAnomaly: false
      },
      {
        version: 2,
        eventType: 'LOADED_ON_SHIP',
        timestamp: '2026-08-02T12:00:00.000Z',
        temperature: 4.0,
        threshold: 4.0,
        humidity: 55.4,
        batteryVoltage: 3.91,
        ambientTemp: 22.5,
        isAnomaly: false
      },
      {
        version: 3,
        eventType: 'TEMPERATURE_SPIKE',
        timestamp: '2026-08-03T16:30:00.000Z',
        temperature: 15.6,
        threshold: 4.0,
        humidity: 79.1,
        batteryVoltage: 3.84,
        ambientTemp: 28.2,
        isAnomaly: true
      },
      {
        version: 4,
        eventType: 'ARRIVED_AT_PORT',
        timestamp: '2026-08-05T08:00:00.000Z',
        temperature: 4.0,
        threshold: 4.0,
        humidity: 60.0,
        batteryVoltage: 3.79,
        ambientTemp: 23.0,
        isAnomaly: false
      }
    ]
  };

  await t.test('formats Recharts coordinates and series items properly', () => {
    const formattedPoints = mockApiTelemetry.timeSeries.map((item) => ({
      name: `v${item.version} ${item.eventType}`,
      shortName: `v${item.version}`,
      version: item.version,
      temperature: item.temperature,
      threshold: item.threshold,
      humidity: item.humidity,
      ambientTemp: item.ambientTemp,
      batteryVoltage: item.batteryVoltage,
      isAnomaly: item.isAnomaly
    }));

    assert.equal(formattedPoints.length, 4);
    assert.equal(formattedPoints[0].shortName, 'v1');
    assert.equal(formattedPoints[2].shortName, 'v3');
    assert.equal(formattedPoints[2].temperature, 15.6);
    assert.equal(formattedPoints[2].isAnomaly, true);
  });

  await t.test('detects thermal anomalies that breach critical regulatory threshold', () => {
    const threshold = mockApiTelemetry.metrics.criticalThreshold;
    const anomalyPoints = mockApiTelemetry.timeSeries.filter(
      (p) => p.temperature > threshold || p.isAnomaly
    );

    assert.equal(anomalyPoints.length, 1);
    assert.equal(anomalyPoints[0].version, 3);
    assert.equal(anomalyPoints[0].temperature, 15.6);
    assert.ok(anomalyPoints[0].temperature > threshold);
  });

  await t.test('verifies cold-chain KPI metrics consistency', () => {
    const { metrics, timeSeries } = mockApiTelemetry;
    const temps = timeSeries.map((p) => p.temperature);

    assert.equal(metrics.minTemperature, Math.min(...temps));
    assert.equal(metrics.maxTemperature, Math.max(...temps));
    assert.equal(metrics.anomaliesDetected, 1);
    assert.equal(metrics.criticalThreshold, 4.0);
    assert.ok(metrics.latestBatteryVoltage > 3.0, 'Battery must maintain sufficient voltage for IoT sensor telemetry');
  });
});
