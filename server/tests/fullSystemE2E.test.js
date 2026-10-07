/**
 * Day 27: Full-System End-to-End Integration Test Suite
 * Person 1 (Domain): Chhotadon <yk3144779@gmail.com>
 *
 * Validates the complete lifecycle: Command Dispatch -> OCC Check -> Event Store Append
 * -> Projection Worker Read Model -> Telemetry Query -> Historical Replay -> OCC Conflict Rejection.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { validateCommand, validateStateTransition, COMMAND_TYPES } = require('../src/domain/commandValidation');
const { createShipmentAggregate } = require('../src/domain/shipmentAggregate');
const { projectEvent } = require('../src/projections/shipmentProjection');
const { reconstructShipmentState, reconstructStateAsOf } = require('../src/domain/shipmentReconstruction');
const { detectEventAnomaly, resolveCargoProfile } = require('../src/domain/anomalyDetector');
const { ConcurrencyException } = require('../src/utils/errors');
const { validateOptimisticLock } = require('../src/concurrency/optimisticConcurrency');

describe('Day 27: Person 1 Domain - Full-System End-to-End Integration Loop', () => {
  const shipmentId = 'SHIP-E2E-FULL-LOOP-2026';
  let eventHistory = [];
  let readModel = null;

  beforeEach(() => {
    eventHistory = [];
    readModel = null;
  });

  test('executes complete Command -> OCC -> Event Store -> Projection -> Replay -> Conflict loop', () => {
    // -------------------------------------------------------------
    // Step 1: Dispatch CREATE_CONTAINER Command (Version 0 -> 1)
    // -------------------------------------------------------------
    const createCmd = {
      type: COMMAND_TYPES.CREATE_CONTAINER,
      shipmentId,
      cargo: 'Pfizer mRNA Cold-Chain Vaccines',
      origin: 'Port of Rotterdam',
      destination: 'Port of Singapore',
      expectedVersion: 0
    };

    assert.ok(validateCommand(createCmd));
    const aggregate = createShipmentAggregate(shipmentId);
    assert.equal(aggregate.state.version, 0);

    // OCC Check
    validateOptimisticLock({ expectedVersion: createCmd.expectedVersion, currentVersion: aggregate.state.version, shipmentId });

    // Create & Append Domain Event
    const event1 = {
      aggregateId: shipmentId,
      version: 1,
      eventType: 'CONTAINER_CREATED',
      payload: {
        cargo: createCmd.cargo,
        origin: createCmd.origin,
        destination: createCmd.destination,
        temperature: 4.0,
        threshold: 8.0,
        sensorId: 'IOT-REEFER-01'
      },
      timestamp: new Date('2026-10-01T10:00:00Z')
    };
    eventHistory.push(event1);

    // Update Projection Read Model
    readModel = projectEvent(readModel, event1);
    assert.equal(readModel.shipmentId, shipmentId);
    assert.equal(readModel.status, 'CREATED');
    assert.equal(readModel.lastAppliedVersion, 1);

    // -------------------------------------------------------------
    // Step 2: Dispatch LOAD_ON_SHIP Command (Version 1 -> 2)
    // -------------------------------------------------------------
    const loadCmd = {
      type: COMMAND_TYPES.LOAD_ON_SHIP,
      shipmentId,
      vessel: 'Arctic Frost Express',
      port: 'Port of Rotterdam',
      expectedVersion: 1
    };

    assert.ok(validateCommand(loadCmd));
    assert.ok(validateStateTransition(readModel, loadCmd.type));
    validateOptimisticLock({ expectedVersion: loadCmd.expectedVersion, currentVersion: readModel.lastAppliedVersion, shipmentId });

    const event2 = {
      aggregateId: shipmentId,
      version: 2,
      eventType: 'LOADED_ON_SHIP',
      payload: {
        vessel: loadCmd.vessel,
        port: loadCmd.port,
        temperature: 4.2,
        threshold: 8.0,
        batteryVoltage: 3.88
      },
      timestamp: new Date('2026-10-02T12:00:00Z')
    };
    eventHistory.push(event2);

    readModel = projectEvent(readModel, event2);
    assert.equal(readModel.status, 'LOADED');
    assert.equal(readModel.vessel, 'Arctic Frost Express');
    assert.equal(readModel.lastAppliedVersion, 2);

    // -------------------------------------------------------------
    // Step 3: Dispatch RECORD_TEMPERATURE_SPIKE Command (Version 2 -> 3)
    // -------------------------------------------------------------
    const spikeCmd = {
      type: COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
      shipmentId,
      temperature: 13.5,
      threshold: 8.0,
      humidity: 82.0,
      batteryVoltage: 3.65,
      expectedVersion: 2
    };

    assert.ok(validateCommand(spikeCmd));
    assert.ok(validateStateTransition(readModel, spikeCmd.type));
    validateOptimisticLock({ expectedVersion: spikeCmd.expectedVersion, currentVersion: readModel.lastAppliedVersion, shipmentId });

    const event3 = {
      aggregateId: shipmentId,
      version: 3,
      eventType: 'TEMPERATURE_SPIKE',
      payload: {
        temperature: spikeCmd.temperature,
        threshold: spikeCmd.threshold,
        humidity: spikeCmd.humidity,
        batteryVoltage: spikeCmd.batteryVoltage,
        ambientTemp: 32.0,
        sensorId: 'IOT-REEFER-01'
      },
      timestamp: new Date('2026-10-03T18:30:00Z')
    };
    eventHistory.push(event3);

    // Verify Automated Anomaly Threshold Evaluation (Day 25)
    const anomalyEvaluation = detectEventAnomaly(event3, 'PHARMA');
    assert.equal(anomalyEvaluation.isAnomaly, true);
    assert.equal(anomalyEvaluation.severity, 'CRITICAL');

    readModel = projectEvent(readModel, event3);
    assert.equal(readModel.temperature, 13.5);
    assert.equal(readModel.lastAppliedVersion, 3);

    // -------------------------------------------------------------
    // Step 4: Validate Concurrent Command Conflict (OCC 409 Violation)
    // -------------------------------------------------------------
    const staleConcurrentCmd = {
      type: COMMAND_TYPES.ARRIVE_AT_PORT,
      shipmentId,
      port: 'Port of Singapore',
      expectedVersion: 1 // Stale expected version! Current is 3.
    };

    assert.throws(
      () => {
        validateOptimisticLock({ expectedVersion: staleConcurrentCmd.expectedVersion, currentVersion: readModel.lastAppliedVersion, shipmentId });
      },
      (err) => {
        assert.ok(err instanceof ConcurrencyException);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'CONCURRENCY_CONFLICT');
        assert.equal(err.expectedVersion, 1);
        assert.equal(err.currentVersion, 3);
        assert.match(err.resolutionHint, /Refresh latest state/);
        return true;
      }
    );

    // -------------------------------------------------------------
    // Step 5: Validate Deterministic Temporal Event Replay & Point-in-Time Scrubbing
    // -------------------------------------------------------------
    // Reconstruct full current head
    const replayedHead = reconstructShipmentState(shipmentId, eventHistory);
    assert.equal(replayedHead.version, 3);
    assert.equal(replayedHead.temperature, 13.5);

    // Time-travel scrub back to Version 2 (before thermal spike occurred)
    const historicalSnapshotV2 = reconstructStateAsOf(shipmentId, eventHistory, 2);
    assert.equal(historicalSnapshotV2.version, 2);
    assert.equal(historicalSnapshotV2.status, 'LOADED');
    assert.equal(historicalSnapshotV2.temperature, null);
    assert.equal(historicalSnapshotV2.vessel, 'Arctic Frost Express');
  });
});
