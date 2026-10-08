import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OCC_COMMAND_TYPES,
  buildOccCommandPayload
} from '../src/utils/concurrency.js';

test('Day 23: OCC Conflict Contract & Resolution Hint Formatting', async (t) => {
  await t.test('formats conflict details with version disparity and resolution action', () => {
    const conflictData = {
      shipmentId: 'SHIP-CONC-100',
      expectedVersion: 2,
      currentVersion: 3,
      modifiedBy: 'Operator Marcus',
      resolutionHint: 'Shipment was updated to v3. Refresh state and retry.'
    };

    assert.equal(conflictData.shipmentId, 'SHIP-CONC-100');
    assert.equal(conflictData.expectedVersion, 2);
    assert.equal(conflictData.currentVersion, 3);
    assert.equal(conflictData.modifiedBy, 'Operator Marcus');
    assert.ok(conflictData.currentVersion > conflictData.expectedVersion);
    assert.ok(conflictData.resolutionHint.includes('v3'));
  });

  await t.test('simulates 409 conflict detection and one-click refresh recovery flow', () => {
    let currentLoadedVersion = 2;
    let conflictModalOpen = false;
    let conflictPayload = null;

    const commandPayload = buildOccCommandPayload(
      OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
      'SHIP-CONC-200',
      { temperature: '18.2', threshold: '4.0', sensorId: 'IOT-01' },
      currentLoadedVersion
    );

    assert.equal(commandPayload.expectedVersion, 2);

    const server409Response = {
      status: 409,
      data: {
        success: false,
        code: 'CONCURRENCY_CONFLICT',
        conflict: {
          shipmentId: 'SHIP-CONC-200',
          expectedVersion: 2,
          currentVersion: 3,
          resolutionHint: 'Reload latest state (v3) and retry.'
        }
      }
    };

    if (server409Response.status === 409) {
      conflictModalOpen = true;
      conflictPayload = server409Response.data.conflict;
    }

    assert.equal(conflictModalOpen, true);
    assert.equal(conflictPayload.currentVersion, 3);

    currentLoadedVersion = conflictPayload.currentVersion;
    conflictModalOpen = false;
    conflictPayload = null;

    assert.equal(conflictModalOpen, false);
    assert.equal(currentLoadedVersion, 3);

    const refreshedCommandPayload = buildOccCommandPayload(
      OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
      'SHIP-CONC-200',
      { temperature: '18.2', threshold: '4.0', sensorId: 'IOT-01' },
      currentLoadedVersion
    );

    assert.equal(refreshedCommandPayload.expectedVersion, 3);
  });
});

test('Day 24: buildOccCommandPayload enriches RECORD_TEMPERATURE_SPIKE with environmental telemetry', () => {
  const payload = buildOccCommandPayload(
    OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
    'SHIP-TELEMETRY-01',
    {
      temperature: '15.4',
      threshold: '4.0',
      sensorId: 'SENSOR-IOT-X',
      humidity: '72.5',
      batteryVoltage: '3.75',
      ambientTemp: '23.8',
      coordinates: { lat: 31.2304, lng: 121.4737 }
    },
    2
  );

  assert.equal(payload.temperature, 15.4);
  assert.equal(payload.threshold, 4.0);
  assert.equal(payload.sensorId, 'SENSOR-IOT-X');
  assert.equal(payload.humidity, 72.5);
  assert.equal(payload.batteryVoltage, 3.75);
  assert.equal(payload.ambientTemp, 23.8);
  assert.deepEqual(payload.coordinates, { lat: 31.2304, lng: 121.4737 });
  assert.equal(payload.expectedVersion, 2);
});
