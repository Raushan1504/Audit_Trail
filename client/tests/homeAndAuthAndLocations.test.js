import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAJOR_PORTS,
  resolvePortLocation,
  getRouteCorridorLocations,
  resolveVesselCurrentLocationName,
  CORRIDOR_WAYPOINTS,
  latLonToSvg
} from '../src/utils/geoCoordinates.js';
import {
  DEMO_OPERATORS,
  validateOperatorCredentials,
  createSessionToken
} from '../src/utils/authProfiles.js';

describe('Day 23 Features: Map Location Names, Route Corridor & Waypoints', () => {
  it('resolves key corridor locations including origin, waypoints, and destination', () => {
    const origin = MAJOR_PORTS.SHANGHAI;
    const dest = MAJOR_PORTS.ROTTERDAM;

    const locations = getRouteCorridorLocations(origin, dest);
    assert.ok(Array.isArray(locations));
    assert.ok(locations.length >= 3, 'Should contain origin, waypoints, and destination');

    // Verify Origin is first
    assert.equal(locations[0].type, 'ORIGIN');
    assert.equal(locations[0].name, 'Port of Shanghai');
    assert.equal(locations[0].country, 'China');

    // Verify Destination is last
    const last = locations[locations.length - 1];
    assert.equal(last.type, 'DESTINATION');
    assert.equal(last.name, 'Port of Rotterdam');
    assert.equal(last.country, 'Netherlands');

    // Verify intermediate waypoints exist and have valid coordinates
    const waypoints = locations.filter((loc) => loc.type === 'WAYPOINT');
    assert.ok(waypoints.length > 0, 'Must have intermediate corridor waypoints');
    waypoints.forEach((wp) => {
      assert.ok(wp.name, 'Waypoint must have name');
      assert.ok(wp.shortName, 'Waypoint must have short name for map tag');
      assert.ok(typeof wp.lat === 'number');
      assert.ok(typeof wp.lon === 'number');

      // Verify SVG projection succeeds
      const svgPt = latLonToSvg(wp.lat, wp.lon);
      assert.ok(svgPt.x >= 0 && svgPt.x <= 1000);
      assert.ok(svgPt.y >= 0 && svgPt.y <= 500);
    });
  });

  it('resolves vessel location name to berthed at origin for initial state', () => {
    const origin = MAJOR_PORTS.SHANGHAI;
    const dest = MAJOR_PORTS.ROTTERDAM;
    const vesselGeo = { lat: origin.lat, lon: origin.lon };

    const locName = resolveVesselCurrentLocationName(vesselGeo, origin, dest, 0.0, { status: 'CREATED' });
    assert.ok(locName.includes('Port of Shanghai'));
    assert.ok(locName.includes('Berthed'));
  });

  it('resolves vessel location name to discharged at destination for terminal state', () => {
    const origin = MAJOR_PORTS.SHANGHAI;
    const dest = MAJOR_PORTS.ROTTERDAM;
    const vesselGeo = { lat: dest.lat, lon: dest.lon };

    const locName = resolveVesselCurrentLocationName(vesselGeo, origin, dest, 1.0, { status: 'ARRIVED' });
    assert.ok(locName.includes('Port of Rotterdam'));
    assert.ok(locName.includes('Discharged'));
  });

  it('resolves vessel location name to nearby waypoint when in proximity', () => {
    const origin = MAJOR_PORTS.SHANGHAI;
    const dest = MAJOR_PORTS.ROTTERDAM;
    const suezWp = CORRIDOR_WAYPOINTS.find((wp) => wp.id === 'WP_SUEZ');

    const vesselGeo = { lat: suezWp.lat + 0.5, lon: suezWp.lon + 0.5 };
    const locName = resolveVesselCurrentLocationName(vesselGeo, origin, dest, 0.65, { status: 'IN_TRANSIT' });
    assert.ok(locName.includes('Near Suez Canal Transit Corridor'));
  });

  it('resolves geographic ocean sectors during open sea navigation', () => {
    const origin = MAJOR_PORTS.SHANGHAI;
    const dest = MAJOR_PORTS.ROTTERDAM;

    // In East Asia sector
    const loc1 = resolveVesselCurrentLocationName({ lat: 25.0, lon: 120.0 }, origin, dest, 0.15, { status: 'IN_TRANSIT' });
    assert.ok(loc1.includes('East China Sea'));

    // In Indian Ocean sector (open sea)
    const loc2 = resolveVesselCurrentLocationName({ lat: -5.0, lon: 65.0 }, origin, dest, 0.45, { status: 'IN_TRANSIT' });
    assert.ok(loc2.includes('Indian Ocean'));

    // In Red Sea sector
    const loc3 = resolveVesselCurrentLocationName({ lat: 22.0, lon: 38.0 }, origin, dest, 0.6, { status: 'IN_TRANSIT' });
    assert.ok(loc3.includes('Red Sea'));
  });
});

describe('Day 23 Features: Forensic Operator Authentication & Demo Profiles', () => {
  it('exposes defined demo operator profiles including Aman Kumar and Raushan Kumar', () => {
    assert.ok(Array.isArray(DEMO_OPERATORS));
    assert.ok(DEMO_OPERATORS.length >= 3);

    const aman = DEMO_OPERATORS.find((op) => op.id === 'op_aman');
    assert.ok(aman, 'Aman Kumar operator must be defined');
    assert.equal(aman.name, 'Aman Kumar');
    assert.equal(aman.email, 'aman@audittrail.io');
    assert.ok(aman.role.includes('Forensic Analyst'));

    const raushan = DEMO_OPERATORS.find((op) => op.id === 'op_raushan');
    assert.ok(raushan, 'Raushan Kumar operator must be defined');
    assert.equal(raushan.name, 'Raushan Kumar');
    assert.equal(raushan.email, 'raushan@audittrail.io');
    assert.ok(raushan.role.includes('Chief Auditor'));

    const yash = DEMO_OPERATORS.find((op) => op.id === 'op_yash');
    assert.ok(yash, 'Yash Kamble operator must be defined');
    assert.equal(yash.name, 'Yash Kamble');
    assert.equal(yash.email, 'yash@audittrail.io');
    assert.ok(yash.role.includes('Domain Architect'));
  });

  it('validates operator credentials correctly', () => {
    const valid = validateOperatorCredentials('aman@audittrail.io', 'audit2026');
    assert.equal(valid.valid, true);
    assert.equal(valid.operator.name, 'Aman Kumar');

    const wrongPass = validateOperatorCredentials('aman@audittrail.io', 'wrongpass');
    assert.equal(wrongPass.valid, false);
    assert.equal(wrongPass.error, 'Invalid security passcode.');

    const emptyEmail = validateOperatorCredentials('', 'audit2026');
    assert.equal(emptyEmail.valid, false);

    const emptyPass = validateOperatorCredentials('aman@audittrail.io', '');
    assert.equal(emptyPass.valid, false);
  });

  it('generates cryptographic operator session tokens', () => {
    const token = createSessionToken('op_aman');
    assert.ok(token.startsWith('at_sec_op_aman_'));
    assert.ok(token.length >= 20);
  });
});
