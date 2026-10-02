const test = require('node:test');
const assert = require('node:assert/strict');

const queryService = require('../src/queries/queryService');
const eventStore = require('../src/events/eventStore');
const { validateCommand } = require('../src/domain/commandValidation');

test('Day 24: Enriched TEMPERATURE_SPIKE Command Validation', async (t) => {
  await t.test('accepts valid telemetry attributes on RECORD_TEMPERATURE_SPIKE', () => {
    const validCommand = {
      type: 'RECORD_TEMPERATURE_SPIKE',
      shipmentId: 'SHIP-VAL-001',
      temperature: 15.2,
      threshold: 4.0,
      sensorId: 'SENSOR-IOT-10',
      humidity: 65.4,
      batteryVoltage: 3.82,
      ambientTemp: 24.5
    };

    assert.equal(validateCommand(validCommand), true);
  });

  await t.test('rejects negative or out-of-range humidity percentages', () => {
    assert.throws(
      () => {
        validateCommand({
          type: 'RECORD_TEMPERATURE_SPIKE',
          shipmentId: 'SHIP-VAL-002',
          temperature: 12.0,
          threshold: 4.0,
          humidity: 105.0 // Invalid > 100
        });
      },
      /humidity must be a valid percentage between 0 and 100/
    );

    assert.throws(
      () => {
        validateCommand({
          type: 'RECORD_TEMPERATURE_SPIKE',
          shipmentId: 'SHIP-VAL-002',
          temperature: 12.0,
          threshold: 4.0,
          humidity: -5.0 // Invalid < 0
        });
      },
      /humidity must be a valid percentage between 0 and 100/
    );
  });

  await t.test('rejects invalid batteryVoltage numbers', () => {
    assert.throws(
      () => {
        validateCommand({
          type: 'RECORD_TEMPERATURE_SPIKE',
          shipmentId: 'SHIP-VAL-003',
          temperature: 12.0,
          threshold: 4.0,
          batteryVoltage: -1.5
        });
      },
      /batteryVoltage must be a positive number/
    );
  });
});

test('Day 24: getShipmentTelemetry Query Service', async (t) => {
  await t.test('returns null for empty or non-existent shipmentId', async () => {
    assert.equal(await queryService.getShipmentTelemetry(''), null);
    assert.equal(await queryService.getShipmentTelemetry(null), null);
  });

  await t.test('extracts structured time series and summary metrics across events', async () => {
    const shipmentId = 'SHIP-TEST-TELEMETRY-999';
    const mockEvents = [
      {
        aggregateId: shipmentId,
        version: 1,
        eventType: 'CONTAINER_CREATED',
        timestamp: new Date('2026-08-01T10:00:00.000Z'),
        payload: { origin: 'Port of Rotterdam', destination: 'Port of Singapore', cargo: 'Vaccines' }
      },
      {
        aggregateId: shipmentId,
        version: 2,
        eventType: 'LOADED_ON_SHIP',
        timestamp: new Date('2026-08-02T12:00:00.000Z'),
        payload: { vessel: 'MV EVERGREEN', port: 'Rotterdam Gateway' }
      },
      {
        aggregateId: shipmentId,
        version: 3,
        eventType: 'TEMPERATURE_SPIKE',
        timestamp: new Date('2026-08-03T16:30:00.000Z'),
        payload: {
          temperature: 16.5,
          threshold: 4.0,
          sensorId: 'SENSOR-IOT-99',
          humidity: 78.2,
          batteryVoltage: 3.78,
          ambientTemp: 28.4
        }
      },
      {
        aggregateId: shipmentId,
        version: 4,
        eventType: 'ARRIVED_AT_PORT',
        timestamp: new Date('2026-08-05T08:00:00.000Z'),
        payload: { port: 'Port of Singapore' }
      }
    ];

    // Temporarily mock eventStore.getEventsByAggregateId
    const originalGetEvents = eventStore.getEventsByAggregateId;
    eventStore.getEventsByAggregateId = async (id) => (id === shipmentId ? mockEvents : []);

    try {
      const telemetry = await queryService.getShipmentTelemetry(shipmentId);

      assert.ok(telemetry);
      assert.equal(telemetry.shipmentId, shipmentId);
      assert.equal(telemetry.totalDataPoints, 4);

      // Verify Metrics
      assert.ok(telemetry.metrics);
      assert.equal(telemetry.metrics.maxTemperature, 16.5);
      assert.equal(telemetry.metrics.criticalThreshold, 4.0);
      assert.equal(telemetry.metrics.anomaliesDetected, 1);

      // Verify Time-Series Items
      assert.equal(telemetry.timeSeries.length, 4);

      const v1 = telemetry.timeSeries[0];
      assert.equal(v1.version, 1);
      assert.equal(v1.eventType, 'CONTAINER_CREATED');
      assert.equal(v1.isAnomaly, false);

      const v3 = telemetry.timeSeries[2];
      assert.equal(v3.version, 3);
      assert.equal(v3.eventType, 'TEMPERATURE_SPIKE');
      assert.equal(v3.temperature, 16.5);
      assert.equal(v3.threshold, 4.0);
      assert.equal(v3.humidity, 78.2);
      assert.equal(v3.batteryVoltage, 3.78);
      assert.equal(v3.ambientTemp, 28.4);
      assert.equal(v3.sensorId, 'SENSOR-IOT-99');
      assert.equal(v3.isAnomaly, true);
    } finally {
      eventStore.getEventsByAggregateId = originalGetEvents;
    }
  });
});
