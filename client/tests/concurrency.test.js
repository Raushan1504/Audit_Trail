import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OCC_COMMAND_TYPES,
  getAllowedCommandsForStatus,
  isValidExpectedVersion,
  buildOccCommandPayload
} from '../src/utils/concurrency.js';

test('Day 22 OCC: isValidExpectedVersion validates non-negative integer versions', () => {
  assert.strictEqual(isValidExpectedVersion(0), true);
  assert.strictEqual(isValidExpectedVersion(1), true);
  assert.strictEqual(isValidExpectedVersion(42), true);
  assert.strictEqual(isValidExpectedVersion('5'), true);
  assert.strictEqual(isValidExpectedVersion('0'), true);

  assert.strictEqual(isValidExpectedVersion(-1), false);
  assert.strictEqual(isValidExpectedVersion('-5'), false);
  assert.strictEqual(isValidExpectedVersion(1.5), false);
  assert.strictEqual(isValidExpectedVersion(null), false);
  assert.strictEqual(isValidExpectedVersion(undefined), false);
  assert.strictEqual(isValidExpectedVersion('abc'), false);
  assert.strictEqual(isValidExpectedVersion({}), false);
});

test('Day 22 OCC: getAllowedCommandsForStatus returns compliant domain transitions', () => {

  const createdAllowed = getAllowedCommandsForStatus('CREATED');
  assert.deepStrictEqual(createdAllowed, [OCC_COMMAND_TYPES.LOAD_ON_SHIP]);

  const loadedAllowed = getAllowedCommandsForStatus('LOADED');
  assert.deepStrictEqual(loadedAllowed, [
    OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
    OCC_COMMAND_TYPES.ARRIVE_AT_PORT
  ]);

  const alertAllowed = getAllowedCommandsForStatus('ALERT');
  assert.deepStrictEqual(alertAllowed, [
    OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
    OCC_COMMAND_TYPES.ARRIVE_AT_PORT
  ]);

  const arrivedAllowed = getAllowedCommandsForStatus('ARRIVED');
  assert.deepStrictEqual(arrivedAllowed, []);

  assert.deepStrictEqual(getAllowedCommandsForStatus('UNKNOWN'), []);
  assert.deepStrictEqual(getAllowedCommandsForStatus(null), []);
});

test('Day 22 OCC: buildOccCommandPayload constructs CREATE_CONTAINER with expectedVersion 0', () => {
  const payload = buildOccCommandPayload(
    OCC_COMMAND_TYPES.CREATE_CONTAINER,
    'SHIP-2026-OCC-01',
    {
      origin: 'Port of Antwerp',
      destination: 'Port of Singapore',
      cargo: 'Pharmaceutical Vaccines'
    },
    0
  );

  assert.strictEqual(payload.type, OCC_COMMAND_TYPES.CREATE_CONTAINER);
  assert.strictEqual(payload.shipmentId, 'SHIP-2026-OCC-01');
  assert.strictEqual(payload.origin, 'Port of Antwerp');
  assert.strictEqual(payload.destination, 'Port of Singapore');
  assert.strictEqual(payload.cargo, 'Pharmaceutical Vaccines');
  assert.strictEqual(payload.expectedVersion, 0, 'Genesis container creation must always enforce expectedVersion: 0');
});

test('Day 22 OCC: buildOccCommandPayload constructs LOAD_ON_SHIP forwarding tracked loadedVersion', () => {
  const loadedVersion = 1;
  const payload = buildOccCommandPayload(
    OCC_COMMAND_TYPES.LOAD_ON_SHIP,
    'SHIP-2026-OCC-01',
    {
      vessel: 'MV PACIFIC VOYAGER',
      port: 'Antwerp Gateway Terminal 7'
    },
    loadedVersion
  );

  assert.strictEqual(payload.type, OCC_COMMAND_TYPES.LOAD_ON_SHIP);
  assert.strictEqual(payload.shipmentId, 'SHIP-2026-OCC-01');
  assert.strictEqual(payload.vessel, 'MV PACIFIC VOYAGER');
  assert.strictEqual(payload.port, 'Antwerp Gateway Terminal 7');
  assert.strictEqual(payload.expectedVersion, 1, 'Command must lock to tracked version 1');
});

test('Day 22 OCC: buildOccCommandPayload constructs RECORD_TEMPERATURE_SPIKE with numeric fields and expectedVersion', () => {
  const loadedVersion = 2;
  const payload = buildOccCommandPayload(
    OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
    'SHIP-2026-OCC-01',
    {
      temperature: '14.8',
      threshold: '4.0',
      sensorId: 'SENSOR-IOT-99'
    },
    loadedVersion
  );

  assert.strictEqual(payload.type, OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE);
  assert.strictEqual(payload.shipmentId, 'SHIP-2026-OCC-01');
  assert.strictEqual(payload.temperature, 14.8);
  assert.strictEqual(payload.threshold, 4.0);
  assert.strictEqual(payload.sensorId, 'SENSOR-IOT-99');
  assert.strictEqual(payload.expectedVersion, 2, 'Command must lock to tracked version 2');
});

test('Day 22 OCC: buildOccCommandPayload constructs ARRIVE_AT_PORT and validates input guard', () => {
  const loadedVersion = 3;
  const payload = buildOccCommandPayload(
    OCC_COMMAND_TYPES.ARRIVE_AT_PORT,
    'SHIP-2026-OCC-01',
    {
      port: 'Port of Singapore Berth 4'
    },
    loadedVersion
  );

  assert.strictEqual(payload.type, OCC_COMMAND_TYPES.ARRIVE_AT_PORT);
  assert.strictEqual(payload.shipmentId, 'SHIP-2026-OCC-01');
  assert.strictEqual(payload.port, 'Port of Singapore Berth 4');
  assert.strictEqual(payload.expectedVersion, 3);

  assert.throws(
    () => buildOccCommandPayload(OCC_COMMAND_TYPES.ARRIVE_AT_PORT, '', {}, 3),
    /shipmentId is required/
  );

  assert.throws(
    () => buildOccCommandPayload(OCC_COMMAND_TYPES.ARRIVE_AT_PORT, 'SHIP-01', {}, -1),
    /Invalid OCC expectedVersion/
  );

  assert.throws(
    () => buildOccCommandPayload('UNKNOWN_COMMAND', 'SHIP-01', {}, 1),
    /Unsupported OCC command type/
  );
});

test('Day 22 OCC: simulates React form state tracking and optimistic lock advancement', () => {

  let trackedVersion = 1;
  const formPayloadV1 = buildOccCommandPayload(
    OCC_COMMAND_TYPES.LOAD_ON_SHIP,
    'SHIP-001',
    { vessel: 'MV ARCTIC', port: 'Rotterdam' },
    trackedVersion
  );
  assert.strictEqual(formPayloadV1.expectedVersion, 1);

  trackedVersion = trackedVersion + 1;
  assert.strictEqual(trackedVersion, 2);

  const formPayloadV2 = buildOccCommandPayload(
    OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
    'SHIP-001',
    { temperature: '12.5', threshold: '4.0', sensorId: 'IOT-01' },
    trackedVersion
  );
  assert.strictEqual(formPayloadV2.expectedVersion, 2);

  const stalePayload = buildOccCommandPayload(
    OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
    'SHIP-001',
    { temperature: '12.5', threshold: '4.0', sensorId: 'IOT-01' },
    1
  );
  assert.notStrictEqual(stalePayload.expectedVersion, trackedVersion);
  assert.strictEqual(stalePayload.expectedVersion, 1);
});
