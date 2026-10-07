#!/usr/bin/env node
/**
 * Day 26: CLI Logistics Scenario Seeder
 * Person 1 (Domain): Yash Kamble <yk3144779@gmail.com>
 *
 * Seeds comprehensive realistic scenarios (Pharma Cold-Chain, Trans-Oceanic Electronics, Sub-Zero Seafood)
 * directly into MongoDB Event Store and projects read models.
 *
 * Usage:
 *   node scripts/seedLogisticsScenarios.js
 *   node scripts/seedLogisticsScenarios.js --scenario=PHARMA
 *   node scripts/seedLogisticsScenarios.js --dry-run
 */

const { connectDB, disconnectDB } = require('../src/config/db');
const Event = require('../src/models/Event');
const ShipmentReadModel = require('../src/models/ShipmentReadModel');
const { buildAllEnterpriseScenarios, SCENARIO_TYPES } = require('../src/domain/scenarioGenerator');
const { projectEvent } = require('../src/projections/shipmentProjection');

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const scenarioArg = process.argv.find((a) => a.startsWith('--scenario='))?.split('=')[1];

  console.log('='.repeat(70));
  console.log('🚢 Audit Trail — Enterprise Logistics Scenario Seed Generator');
  console.log('='.repeat(70));
  if (isDryRun) console.log('🔍 DRY RUN ACTIVE: No database writes will be executed.');

  let conn = null;
  if (!isDryRun) {
    try {
      conn = await connectDB();
    } catch (err) {
      console.warn('⚠️ Could not connect to MongoDB. Running in dry-run simulation mode.');
    }
  }

  const allScenarios = buildAllEnterpriseScenarios();
  const scenariosToSeed = scenarioArg
    ? allScenarios.filter((s) => s.type.toUpperCase() === scenarioArg.toUpperCase())
    : allScenarios;

  console.log(`\nDiscovered ${scenariosToSeed.length} target enterprise scenario(s):`);

  for (const scenario of scenariosToSeed) {
    console.log(`\n📦 [${scenario.type}] Shipment: ${scenario.shipmentId}`);
    console.log(`   Cargo: ${scenario.cargo}`);
    console.log(`   Events Count: ${scenario.events.length}`);

    if (conn && !isDryRun) {
      // Clear existing records for idempotency
      await Event.deleteMany({ aggregateId: scenario.shipmentId });
      await ShipmentReadModel.deleteMany({ shipmentId: scenario.shipmentId });

      let currentReadModel = null;
      for (const event of scenario.events) {
        await Event.create(event);
        currentReadModel = projectEvent(currentReadModel, event);
      }

      if (currentReadModel) {
        await ShipmentReadModel.create(currentReadModel);
      }
      console.log(`   ✓ Successfully seeded and projected ${scenario.shipmentId}`);
    } else {
      console.log(`   ✓ Simulated generation of ${scenario.events.length} chronological events`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎉 Scenario Seeding Complete!');
  console.log('='.repeat(70));

  if (conn) {
    await disconnectDB();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
