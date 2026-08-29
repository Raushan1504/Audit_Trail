const test = require('node:test');
const assert = require('node:assert');
const { reconstructShipmentState } = require('../src/domain/shipmentReconstruction');
const { EVENT_TYPES } = require('../src/events/eventTypes');

test('reconstructShipmentState throws error if shipmentId or events are invalid', () => {
  assert.throws(() => reconstructShipmentState(null, []), /shipmentId is required/);
  assert.throws(() => reconstructShipmentState('SHIP-001', null), /events must be an array/);
});

test('reconstructShipmentState reconstructs correct state after event sequence', () => {
  const shipmentId = 'SHIP-001';
  const events = [
    {
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.CONTAINER_CREATED,
      payload: { origin: 'Shanghai', destination: 'Rotterdam' },
      version: 1,
      timestamp: new Date('2026-08-01T00:00:00Z')
    },
    {
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.LOADED_ON_SHIP,
      payload: { vessel: 'Ever Given', port: 'Shanghai Port' },
      version: 2,
      timestamp: new Date('2026-08-02T00:00:00Z')
    },
    {
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
      payload: { temperature: 28.5, threshold: 25.0, sensorId: 'SENSOR-1' },
      version: 3,
      timestamp: new Date('2026-08-03T00:00:00Z')
    },
    {
      aggregateId: shipmentId,
      eventType: EVENT_TYPES.ARRIVED_AT_PORT,
      payload: { port: 'Rotterdam Port' },
      version: 4,
      timestamp: new Date('2026-08-04T00:00:00Z')
    }
  ];

  const reconstructed = reconstructShipmentState(shipmentId, events);

  assert.strictEqual(reconstructed.shipmentId, 'SHIP-001');
  assert.strictEqual(reconstructed.status, 'ARRIVED');
  assert.strictEqual(reconstructed.version, 4);
  assert.strictEqual(reconstructed.temperature, 28.5);
  assert.strictEqual(reconstructed.location, 'Rotterdam Port');
  assert.strictEqual(reconstructed.vessel, 'Ever Given');
});
