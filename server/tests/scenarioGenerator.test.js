const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  SCENARIO_TYPES,
  SCENARIO_TEMPLATES,
  generateScenarioEvents,
  buildAllEnterpriseScenarios
} = require('../src/domain/scenarioGenerator');

describe('Day 26: Person 1 Domain - Logistics Scenario Seed Generator', () => {
  test('defines canonical enterprise scenario types', () => {
    assert.ok(SCENARIO_TYPES.PHARMA);
    assert.ok(SCENARIO_TYPES.OCEAN_ELECTRONICS);
    assert.ok(SCENARIO_TYPES.FROZEN_SEAFOOD);
  });

  test('generates valid chronological event sequences for PHARMA scenario', () => {
    const events = generateScenarioEvents(SCENARIO_TYPES.PHARMA);
    assert.equal(events.length, 4);

    assert.equal(events[0].version, 1);
    assert.equal(events[0].eventType, 'CONTAINER_CREATED');
    assert.match(events[0].payload.cargo, /Vaccine/);

    assert.equal(events[1].version, 2);
    assert.equal(events[1].eventType, 'LOADED_ON_SHIP');

    assert.equal(events[2].version, 3);
    assert.equal(events[2].eventType, 'TEMPERATURE_SPIKE');
    assert.ok(events[2].payload.temperature > events[2].payload.threshold);

    assert.equal(events[3].version, 4);
    assert.equal(events[3].eventType, 'ARRIVED_AT_PORT');
  });

  test('supports custom shipmentId assignment during scenario generation', () => {
    const customId = 'SHIP-CUSTOM-TEST-007';
    const events = generateScenarioEvents(SCENARIO_TYPES.FROZEN_SEAFOOD, customId);

    events.forEach((event) => {
      assert.equal(event.aggregateId, customId);
    });
  });

  test('buildAllEnterpriseScenarios produces full scenario collection with valid versions', () => {
    const scenarios = buildAllEnterpriseScenarios();
    assert.equal(scenarios.length, 3);

    scenarios.forEach((sc) => {
      assert.ok(sc.shipmentId);
      assert.ok(sc.type);
      assert.ok(sc.cargo);
      assert.equal(sc.events.length, 4);

      // Verify strict sequential versioning
      sc.events.forEach((e, idx) => {
        assert.equal(e.version, idx + 1);
      });
    });
  });
});
