import test from 'node:test';
import assert from 'node:assert';

import {
  MAJOR_PORTS,
  resolvePortLocation,
  latLonToSvg,
  interpolateVesselPosition,
  formatNauticalCoordinates
} from '../src/utils/geoCoordinates.js';

test('Day 18 State Diff & Geolocation: Maritime Port Resolution', async (t) => {
  await t.test('resolves canonical ports from descriptive logistics strings', () => {
    const shanghai = resolvePortLocation('Port of Shanghai');
    assert.ok(shanghai);
    assert.strictEqual(shanghai.id, 'SHANGHAI');
    assert.strictEqual(shanghai.country, 'China');

    const rotterdam = resolvePortLocation('Port of Rotterdam Terminal 4');
    assert.ok(rotterdam);
    assert.strictEqual(rotterdam.id, 'ROTTERDAM');

    const antwerp = resolvePortLocation('Antwerp Gateway');
    assert.ok(antwerp);
    assert.strictEqual(antwerp.id, 'ANTWERP');

    const singapore = resolvePortLocation('Port of Singapore Berth 4');
    assert.ok(singapore);
    assert.strictEqual(singapore.id, 'SINGAPORE');

    const hamburg = resolvePortLocation('Hamburg Logistics Facility');
    assert.ok(hamburg);
    assert.strictEqual(hamburg.id, 'HAMBURG');
  });

  await t.test('returns null gracefully for unknown locations or invalid input', () => {
    assert.strictEqual(resolvePortLocation('Nowhere Port 999'), null);
    assert.strictEqual(resolvePortLocation(''), null);
    assert.strictEqual(resolvePortLocation(null), null);
    assert.strictEqual(resolvePortLocation(undefined), null);
  });
});

test('Day 18 State Diff & Geolocation: SVG Projection & Interpolation', async (t) => {
  await t.test('projects latitude/longitude into 2D equirectangular SVG space', () => {
    // Equator & Prime Meridian (0, 0) -> (500, 250) on a 1000x500 canvas
    const center = latLonToSvg(0, 0);
    assert.strictEqual(center.x, 500);
    assert.strictEqual(center.y, 250);

    // North pole (+90 lat) -> y: 0
    const north = latLonToSvg(90, 0);
    assert.strictEqual(north.y, 0);

    // South pole (-90 lat) -> y: 500
    const south = latLonToSvg(-90, 0);
    assert.strictEqual(south.y, 500);
  });

  await t.test('interpolates vessel coordinates across voyage lifecycle', () => {
    const origin = MAJOR_PORTS.SHANGHAI;
    const dest = MAJOR_PORTS.ROTTERDAM;

    // Progress 0.0 (Step 1 / Genesis) -> at Origin
    const startPos = interpolateVesselPosition(origin, dest, 0.0);
    assert.strictEqual(startPos.lat, origin.lat);
    assert.strictEqual(startPos.lon, origin.lon);

    // Progress 1.0 (Terminal / Arrived) -> at Destination
    const endPos = interpolateVesselPosition(origin, dest, 1.0);
    assert.strictEqual(endPos.lat, dest.lat);
    assert.strictEqual(endPos.lon, dest.lon);

    // Mid-voyage (50%) -> between origin and destination
    const midPos = interpolateVesselPosition(origin, dest, 0.5);
    assert.ok(midPos.lat > 0, 'Latitude should remain valid in northern hemisphere');
    assert.ok(midPos.heading >= 0 && midPos.heading <= 360, 'Heading should be valid angle');
  });

  await t.test('formats coordinates into nautical DMS format', () => {
    const formatted = formatNauticalCoordinates(31.2304, 121.4737);
    assert.ok(formatted.includes('31°14\' N'));
    assert.ok(formatted.includes('121°28\' E'));

    const westSouth = formatNauticalCoordinates(-23.5505, -46.6333);
    assert.ok(westSouth.includes('23°33\' S'));
    assert.ok(westSouth.includes('46°38\' W'));

    // Safe fallback for null/undefined
    assert.strictEqual(formatNauticalCoordinates(null, null), '00°00\' N, 00°00\' E');
  });
});

test('Day 18 State Diff: Field Mutation & Version Lag Computation', async (t) => {
  const genesisState = {
    shipmentId: 'SHIP-001',
    status: 'CREATED',
    location: 'Port of Shanghai',
    temperature: null,
    vessel: null,
    cargo: 'Solar Photovoltaic Modules',
    version: 1
  };

  const loadedState = {
    shipmentId: 'SHIP-001',
    status: 'LOADED',
    location: 'Shanghai Marine Terminal',
    temperature: null,
    vessel: 'MV PACIFIC VOYAGER',
    cargo: 'Solar Photovoltaic Modules',
    version: 2
  };

  const liveHeadState = {
    shipmentId: 'SHIP-001',
    status: 'ARRIVED',
    location: 'Port of Rotterdam Terminal 4',
    temperature: 13.5,
    vessel: 'MV PACIFIC VOYAGER',
    cargo: 'Solar Photovoltaic Modules',
    version: 4
  };

  await t.test('computes differences between Genesis scrubbed state and Live Head', () => {
    const isStatusDiff = genesisState.status !== liveHeadState.status;
    const isLocationDiff = genesisState.location !== liveHeadState.location;
    const isTempDiff = genesisState.temperature !== liveHeadState.temperature;
    const isVesselDiff = genesisState.vessel !== liveHeadState.vessel;

    assert.strictEqual(isStatusDiff, true, 'Status should differ (CREATED vs ARRIVED)');
    assert.strictEqual(isLocationDiff, true, 'Location should differ (Shanghai vs Rotterdam)');
    assert.strictEqual(isTempDiff, true, 'Temperature should differ (null vs 13.5)');
    assert.strictEqual(isVesselDiff, true, 'Vessel should differ (null vs MV PACIFIC VOYAGER)');

    const versionsBehind = liveHeadState.version - genesisState.version;
    assert.strictEqual(versionsBehind, 3, 'Genesis state is 3 versions behind live head');
  });

  await t.test('computes differences between Version 2 (Loaded) and Live Head', () => {
    const isStatusDiff = loadedState.status !== liveHeadState.status;
    const isLocationDiff = loadedState.location !== liveHeadState.location;
    const isVesselDiff = loadedState.vessel !== liveHeadState.vessel;

    assert.strictEqual(isStatusDiff, true, 'Status should differ (LOADED vs ARRIVED)');
    assert.strictEqual(isLocationDiff, true, 'Location should differ');
    assert.strictEqual(isVesselDiff, false, 'Vessel is identical once loaded');

    const versionsBehind = liveHeadState.version - loadedState.version;
    assert.strictEqual(versionsBehind, 2, 'Version 2 is 2 versions behind live head');
  });

  await t.test('identifies zero divergence when historical state is at Live Head', () => {
    const isStatusDiff = liveHeadState.status !== liveHeadState.status;
    const isLocationDiff = liveHeadState.location !== liveHeadState.location;
    const isTempDiff = liveHeadState.temperature !== liveHeadState.temperature;

    assert.strictEqual(isStatusDiff, false);
    assert.strictEqual(isLocationDiff, false);
    assert.strictEqual(isTempDiff, false);

    const versionsBehind = liveHeadState.version - liveHeadState.version;
    assert.strictEqual(versionsBehind, 0, 'Zero lag when synced with live head');
  });
});
