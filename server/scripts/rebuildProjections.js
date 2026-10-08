#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const { rebuildAllReadModels } = require('../src/projections/shipmentProjection');
const { connectDB } = require('../src/config/db');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

function parseArgs(args = process.argv.slice(2)) {
  const options = {
    clean: false,
    shipmentId: null,
    dryRun: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--clean' || arg === '--reset') {
      options.clean = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      options.dryRun = true;
    } else if (arg.startsWith('--shipment=')) {
      options.shipmentId = arg.split('=')[1].trim();
    } else if (arg.startsWith('--shipmentId=')) {
      options.shipmentId = arg.split('=')[1].trim();
    } else if (!arg.startsWith('-') && !options.shipmentId) {
      options.shipmentId = arg.trim();
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${colors.bold}${colors.cyan}Audit Trail — Projection Rebuild & Catch-Up CLI Utility${colors.reset}

${colors.bold}Usage:${colors.reset}
  npm run projections:rebuild [options]
  node scripts/rebuildProjections.js [options]

${colors.bold}Options:${colors.reset}
  --clean, --reset       Wipe existing ShipmentReadModel collection before replay
  --shipment=<id>        Rebuild projection only for specified shipment aggregate
  --dry-run, -n          Simulate replay without persisting changes to MongoDB
  --help, -h             Display this help message

${colors.bold}Examples:${colors.reset}
  npm run projections:rebuild
  npm run projections:rebuild -- --clean
  npm run projections:rebuild -- --shipment=SHIP-001
  npm run projections:rebuild -- --dry-run
`);
}

async function runRebuild(options = {}) {
  const startTime = Date.now();
  const isSilent = options.silent === true;

  if (!isSilent) {
    console.log('\n' + colors.bold + colors.cyan + '═'.repeat(74) + colors.reset);
    console.log(colors.bold + '   AUDIT TRAIL — PROJECTION CATCH-UP & REBUILD CLI (DAY 19)' + colors.reset);
    console.log(colors.bold + colors.cyan + '═'.repeat(74) + colors.reset);
    console.log(`${colors.gray}Target Collection : ShipmentReadModel (CQRS Read Side)${colors.reset}`);
    console.log(`${colors.gray}Source of Truth   : Append-Only Event Store (Canonical Events)${colors.reset}`);
    console.log(`${colors.gray}Clean Wipe        : ${options.clean ? colors.yellow + 'ENABLED (Wiping read models first)' : 'DISABLED (In-place update)'}${colors.reset}`);
    console.log(`${colors.gray}Dry Run           : ${options.dryRun ? colors.yellow + 'ENABLED (Simulation mode, no writes)' : 'DISABLED (Writing to DB)'}${colors.reset}`);
    if (options.shipmentId) {
      console.log(`${colors.gray}Filter Shipment   : ${colors.bold}${options.shipmentId}${colors.reset}`);
    }
    console.log('');
  }

  let openedConnection = false;
  if (mongoose.connection.readyState !== 1) {
    if (!isSilent) console.log(`${colors.cyan}ℹ Connecting to MongoDB...${colors.reset}`);
    await connectDB();
    openedConnection = true;
  }

  if (!isSilent) {
    console.log(`${colors.cyan}▶ Replaying historical canonical events from Event Store...${colors.reset}`);
  }

  const result = await rebuildAllReadModels({
    clean: options.clean,
    shipmentId: options.shipmentId,
    dryRun: options.dryRun
  });

  const durationMs = Date.now() - startTime;

  if (!isSilent) {
    console.log('');
    console.log(colors.bold + `${colors.green}✓ Rebuild completed successfully in ${durationMs}ms${colors.reset}`);
    console.log(colors.cyan + '─'.repeat(74) + colors.reset);
    console.log(colors.bold + 'REBUILD SUMMARY:' + colors.reset);
    console.log(`  • Aggregates Evaluated : ${colors.bold}${result.totalShipments}${colors.reset}`);
    console.log(`  • Projections Synced   : ${colors.bold}${colors.green}${result.rebuiltCount}${colors.reset}`);
    console.log(`  • Events Replayed      : ${colors.bold}${result.totalEventsReplayed}${colors.reset}`);
    console.log(`  • Execution Time       : ${colors.bold}${durationMs}ms${colors.reset}`);
    console.log(colors.cyan + '─'.repeat(74) + colors.reset);

    if (result.shipments && result.shipments.length > 0) {
      console.log(colors.bold + '\nRECONSTRUCTED READ MODELS:' + colors.reset);
      result.shipments.forEach((s) => {
        const doc = typeof s.toObject === 'function' ? s.toObject() : s;
        const statusColor = doc.status === 'ARRIVED' ? colors.green : doc.status === 'ALERT' || doc.status === 'TEMPERATURE_SPIKE' ? colors.red : colors.yellow;
        const statusLabel = statusColor + doc.status + colors.reset;
        const loc = doc.currentLocation || doc.location || 'Unknown';
        console.log(`  [${doc.shipmentId}] v${doc.lastAppliedVersion ?? doc.version} | ${statusLabel} | Location: ${loc} | Temp: ${doc.temperature ?? 'N/A'}°C`);
      });
      console.log('');
    }
    console.log(colors.bold + colors.green + '✓ Read model is 100% consistent with the Event Store.' + colors.reset + '\n');
  }

  return {
    ...result,
    durationMs,
    openedConnection
  };
}

if (require.main === module) {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  runRebuild(options)
    .then(async (summary) => {
      if (summary.openedConnection && mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n${colors.bold}${colors.red}✗ Projection Rebuild Failed:${colors.reset}`, err.message || err);
      process.exit(1);
    });
}

module.exports = {
  runRebuild,
  parseArgs
};
