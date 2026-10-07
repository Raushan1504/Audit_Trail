const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  CARGO_PROFILES,
  resolveCargoProfile,
  evaluateThresholdBreach,
  detectEventAnomaly
} = require('../src/domain/anomalyDetector');

describe('Day 25: Person 1 Domain - Automated Anomaly Threshold Detection', () => {
  describe('Cargo Profile Resolution', () => {
    test('resolves FROZEN profile for seafood and deep-freeze keywords', () => {
      assert.equal(resolveCargoProfile('Frozen Atlantic Salmon').type, 'FROZEN');
      assert.equal(resolveCargoProfile({ description: 'Ice cream cartons' }).type, 'FROZEN');
      assert.equal(resolveCargoProfile('frozen_biologicals').type, 'FROZEN');
    });

    test('resolves PHARMA profile for vaccines and medicines', () => {
      assert.equal(resolveCargoProfile('Moderna mRNA COVID Vaccine').type, 'PHARMA');
      assert.equal(resolveCargoProfile({ type: 'pharma_insulin' }).type, 'PHARMA');
      assert.equal(resolveCargoProfile('clinical biologicals').type, 'PHARMA');
    });

    test('resolves PERISHABLE profile for fresh fruit or default', () => {
      assert.equal(resolveCargoProfile('Fresh Organic Avocados').type, 'PERISHABLE');
      assert.equal(resolveCargoProfile(null).type, 'PERISHABLE');
      assert.equal(resolveCargoProfile('general_goods').type, 'PERISHABLE');
    });

    test('resolves AMBIENT profile for electronics and dry freight', () => {
      assert.equal(resolveCargoProfile('Electronics and microchips').type, 'AMBIENT');
      assert.equal(resolveCargoProfile('dry container freight').type, 'AMBIENT');
    });
  });

  describe('evaluateThresholdBreach', () => {
    test('detects critical breach when frozen cargo exceeds -18°C safe threshold', () => {
      const reading = {
        temperature: -8.5,
        humidity: 50.0,
        batteryVoltage: 3.7
      };
      const result = evaluateThresholdBreach(reading, 'FROZEN');

      assert.equal(result.isAnomaly, true);
      assert.equal(result.severity, 'CRITICAL');
      assert.equal(result.breachesCount, 1);
      assert.equal(result.breaches[0].type, 'CARGO_TEMP_EXCEEDED');
      assert.equal(result.breaches[0].delta, 9.5); // -8.5 - (-18.0) = 9.5°C over safe limit
    });

    test('detects critical breach when temperature exceeds explicit threshold', () => {
      const reading = {
        temperature: 9.2,
        threshold: 4.0,
        humidity: 60.0
      };
      const result = evaluateThresholdBreach(reading, 'PERISHABLE');

      assert.equal(result.isAnomaly, true);
      assert.equal(result.severity, 'CRITICAL');
      assert.equal(result.breaches[0].type, 'TEMPERATURE_SPIKE');
      assert.equal(result.breaches[0].delta, 5.2);
    });

    test('detects warning breach when battery voltage is below operating floor', () => {
      const reading = {
        temperature: 3.5,
        threshold: 4.0,
        batteryVoltage: 3.1
      };
      const result = evaluateThresholdBreach(reading, 'PERISHABLE');

      assert.equal(result.isAnomaly, true);
      assert.equal(result.severity, 'WARNING');
      assert.equal(result.breaches[0].type, 'LOW_BATTERY_RESERVE');
    });

    test('detects excessive humidity anomaly when above cargo profile maximum', () => {
      const reading = {
        temperature: 3.0,
        humidity: 94.0,
        batteryVoltage: 3.8
      };
      const result = evaluateThresholdBreach(reading, 'PERISHABLE');

      assert.equal(result.isAnomaly, true);
      assert.equal(result.severity, 'WARNING');
      assert.equal(result.breaches[0].type, 'EXCESSIVE_HUMIDITY');
    });

    test('returns nominal result when all telemetry parameters are safe', () => {
      const reading = {
        temperature: 2.8,
        threshold: 4.0,
        humidity: 55.0,
        batteryVoltage: 3.82
      };
      const result = evaluateThresholdBreach(reading, 'PERISHABLE');

      assert.equal(result.isAnomaly, false);
      assert.equal(result.severity, 'NORMAL');
      assert.equal(result.breachesCount, 0);
    });
  });

  describe('detectEventAnomaly', () => {
    test('enforces CRITICAL anomaly classification on explicit TEMPERATURE_SPIKE events', () => {
      const spikeEvent = {
        version: 3,
        eventType: 'TEMPERATURE_SPIKE',
        payload: {
          temperature: 12.5,
          threshold: 4.0,
          humidity: 82.0,
          batteryVoltage: 3.65
        }
      };
      const result = detectEventAnomaly(spikeEvent, 'PERISHABLE');

      assert.equal(result.isAnomaly, true);
      assert.equal(result.severity, 'CRITICAL');
      assert.ok(result.breaches.length >= 1);
    });

    test('safely evaluates normal non-spike events', () => {
      const normalEvent = {
        version: 1,
        eventType: 'CONTAINER_CREATED',
        payload: {
          temperature: 3.5,
          origin: 'Port of Rotterdam',
          destination: 'Port of Singapore'
        }
      };
      const result = detectEventAnomaly(normalEvent, 'PERISHABLE');

      assert.equal(result.isAnomaly, false);
      assert.equal(result.severity, 'NORMAL');
    });
  });
});
