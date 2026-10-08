const test = require('node:test');
const assert = require('node:assert');

const {
  runBenchmark,
  generateSyntheticEvents,
  createProjectedReadModel,
  calculateStats,
  parseArgs
} = require('../scripts/benchmarkReadModelVsReplay');

test('Benchmark - generateSyntheticEvents and Projection Snapshot', async (t) => {
  await t.test('generates valid sequence of canonical events with sequential versions', () => {
    const events = generateSyntheticEvents('TEST-SHIP-10', 10);

    assert.strictEqual(events.length, 10);
    assert.strictEqual(events[0].eventType, 'CONTAINER_CREATED');
    assert.strictEqual(events[0].version, 1);
    assert.strictEqual(events[1].eventType, 'LOADED_ON_SHIP');
    assert.strictEqual(events[1].version, 2);
    assert.strictEqual(events[9].eventType, 'ARRIVED_AT_PORT');
    assert.strictEqual(events[9].version, 10);

    for (let i = 0; i < events.length; i++) {
      assert.strictEqual(events[i].version, i + 1, `Event at index ${i} must have version ${i + 1}`);
      assert.strictEqual(events[i].aggregateId, 'TEST-SHIP-10');
      assert.ok(events[i].timestamp instanceof Date);
    }
  });

  await t.test('correctly projects synthetic events into read model snapshot', () => {
    const events = generateSyntheticEvents('TEST-SHIP-10', 10);
    const readModel = createProjectedReadModel(events);

    assert.strictEqual(readModel.shipmentId, 'TEST-SHIP-10');
    assert.strictEqual(readModel.status, 'ARRIVED');
    assert.strictEqual(readModel.lastAppliedVersion, 10);
    assert.strictEqual(readModel._source, 'read_model');
  });
});

test('Benchmark - calculateStats statistical precision', async (t) => {
  await t.test('calculates correct mean, median, min, max, p95 and p99', () => {
    const samples = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
    const stats = calculateStats(samples);

    assert.strictEqual(stats.count, 10);
    assert.strictEqual(stats.min, 1.0);
    assert.strictEqual(stats.max, 10.0);
    assert.strictEqual(stats.mean, 5.5);
    assert.strictEqual(stats.median, 6.0);
    assert.ok(stats.p95 >= 9.0);
    assert.ok(stats.p99 >= 9.0);
  });
});

test('Benchmark - parseArgs CLI flag parsing', async (t) => {
  await t.test('parses events and iterations flags', () => {
    const opts = parseArgs(['--events=100', '--iterations=25', '--json']);
    assert.strictEqual(opts.eventsCount, 100);
    assert.strictEqual(opts.iterations, 25);
    assert.strictEqual(opts.json, true);
  });
});

test('Benchmark - Empirical Read Model Latency SLA Conformance (<10ms)', async (t) => {
  await t.test('proves read model query latency is < 10ms and significantly faster than deep raw replay', async () => {
    const results = await runBenchmark({
      eventsCount: 100,
      iterations: 30
    });

    assert.ok(
      results.readModel.stats.mean < 10.0,
      `Read model mean latency (${results.readModel.stats.mean}ms) must be under 10.0ms`
    );
    assert.ok(
      results.readModel.stats.p95 < 10.0,
      `Read model P95 latency (${results.readModel.stats.p95}ms) must be under 10.0ms`
    );

    assert.ok(
      results.readModel.stats.mean < results.rawReplay.stats.mean,
      'Read model lookup must be faster than raw multi-event replay'
    );

    assert.ok(
      results.payloadComparison.readModelBytes < results.payloadComparison.rawEventsBytes,
      'Read model wire payload must be smaller than multi-event raw array'
    );

    const scaling = results.scalingAnalysis;
    assert.ok(scaling.length >= 4);

    const firstTier = scaling[0];
    const lastTier = scaling[scaling.length - 1];

    assert.ok(
      lastTier.replayMeanMs > firstTier.replayMeanMs,
      'Raw replay latency must scale up with event depth'
    );
    assert.ok(
      lastTier.readModelMeanMs < 10.0,
      'Read model latency must stay under 10ms even for deep historical aggregates'
    );
    assert.ok(
      lastTier.replayMeanMs > 300.0,
      `Deep replay (500 events) should reach >300ms network & processing threshold (observed: ${lastTier.replayMeanMs}ms)`
    );
  });
});
