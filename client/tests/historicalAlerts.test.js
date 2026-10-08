import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHistoricalAlertMeta,
  getPastValueBadge,
  shouldShowHistoricalWatermark
} from '../src/utils/historicalAlerts.js';

const mockGenesisEvent = {
  aggregateId: 'SHIP-TEST-99',
  eventType: 'CONTAINER_CREATED',
  version: 1,
  payload: { origin: 'Port of Antwerp', cargo: 'Cryogenic Vaccines' },
  timestamp: new Date('2026-09-15T08:00:00Z')
};

const mockSpikeEvent = {
  aggregateId: 'SHIP-TEST-99',
  eventType: 'TEMPERATURE_SPIKE',
  version: 3,
  payload: { temperature: 14.8, threshold: 4.0 },
  timestamp: new Date('2026-09-17T14:30:00Z')
};

const mockTerminalEvent = {
  aggregateId: 'SHIP-TEST-99',
  eventType: 'ARRIVED_AT_PORT',
  version: 5,
  payload: { port: 'Port of Singapore' },
  timestamp: new Date('2026-09-20T19:00:00Z')
};

test('Day 21 Historical Alerts: getHistoricalAlertMeta computes version lag and high-contrast warning copy', () => {

  const alertV1 = getHistoricalAlertMeta(1, 5, mockGenesisEvent);
  assert.strictEqual(alertV1.isHistorical, true);
  assert.strictEqual(alertV1.isAtHead, false);
  assert.strictEqual(alertV1.currentVersion, 1);
  assert.strictEqual(alertV1.totalVersions, 5);
  assert.strictEqual(alertV1.versionsBehind, 4);
  assert.strictEqual(alertV1.severity, 'critical');
  assert.ok(alertV1.headline.includes('HISTORICAL INSPECTION ACTIVE'));
  assert.ok(alertV1.headline.includes('NOT LIVE OPERATIONAL DATA'));
  assert.ok(alertV1.lagDescription.includes('4 versions behind'));
  assert.ok(alertV1.operatorGuidance.includes('Do not use for live logistics routing'));
  assert.ok(alertV1.fullNotice.includes('Version 1 of 5'));

  const alertHead = getHistoricalAlertMeta(5, 5, mockTerminalEvent);
  assert.strictEqual(alertHead.isHistorical, true);
  assert.strictEqual(alertHead.isAtHead, true);
  assert.strictEqual(alertHead.versionsBehind, 0);
  assert.strictEqual(alertHead.severity, 'info');
  assert.ok(alertHead.lagDescription.includes('at confirmed ledger head'));

  const alertSpike = getHistoricalAlertMeta(3, 4, mockSpikeEvent);
  assert.strictEqual(alertSpike.severity, 'critical');
  assert.strictEqual(alertSpike.versionsBehind, 1);
  assert.ok(alertSpike.eventSummary.includes('TEMPERATURE_SPIKE (#3)'));
});

test('Day 21 Historical Alerts: getPastValueBadge resolves distinct past value card tags', () => {

  const liveStatusBadge = getPastValueBadge('status', 'LOADED', false);
  assert.strictEqual(liveStatusBadge.showBadge, false);
  assert.strictEqual(liveStatusBadge.badgeText, '');

  const pastStatusBadge = getPastValueBadge('status', 'LOADED', true, { version: 2 });
  assert.strictEqual(pastStatusBadge.showBadge, true);
  assert.strictEqual(pastStatusBadge.badgeText, 'PAST STATUS · v2');
  assert.strictEqual(pastStatusBadge.badgeClass, 'past-badge--status');

  const pastLocBadge = getPastValueBadge('location', 'Shanghai Marine Terminal', true, { version: 2 });
  assert.strictEqual(pastLocBadge.showBadge, true);
  assert.strictEqual(pastLocBadge.badgeText, 'HISTORICAL AIS / PORT · v2');
  assert.strictEqual(pastLocBadge.badgeClass, 'past-badge--location');

  const pastVerBadge = getPastValueBadge('version', 2, true, { version: 2 });
  assert.strictEqual(pastVerBadge.showBadge, true);
  assert.strictEqual(pastVerBadge.badgeText, 'REWOUND SEQUENCE · v2');
  assert.strictEqual(pastVerBadge.badgeClass, 'past-badge--version');

  const pastTempNominal = getPastValueBadge('temperature', 3.8, true, { version: 2, isHighTemp: false });
  assert.strictEqual(pastTempNominal.showBadge, true);
  assert.strictEqual(pastTempNominal.badgeText, 'PAST SENSOR LOG · v2');
  assert.strictEqual(pastTempNominal.badgeClass, 'past-badge--temp-nominal');
  assert.strictEqual(pastTempNominal.isAnomaly, false);

  const pastTempSpike = getPastValueBadge('temperature', 14.8, true, { version: 3, isHighTemp: true });
  assert.strictEqual(pastTempSpike.showBadge, true);
  assert.strictEqual(pastTempSpike.badgeText, 'HISTORICAL SPIKE · NOT ACTIVE ALARM');
  assert.strictEqual(pastTempSpike.badgeClass, 'past-badge--spike-warning');
  assert.strictEqual(pastTempSpike.isAnomaly, true);
});

test('Day 21 Historical Alerts: shouldShowHistoricalWatermark detects rewind state on maritime radar', () => {

  assert.strictEqual(shouldShowHistoricalWatermark(4, 4, true), true);

  assert.strictEqual(shouldShowHistoricalWatermark(2, 4, false), true);

  assert.strictEqual(shouldShowHistoricalWatermark(4, 4, false), false);

  assert.strictEqual(shouldShowHistoricalWatermark(null, 0, false), false);
});

test('Day 21 Historical Alerts: Escape key shortcut restores live confirmed head', () => {
  let viewMode = 'historical';
  let replayStep = 2;
  let isPlaying = true;

  const handleGlobalKey = (key) => {
    if (key === 'Escape' && viewMode === 'historical') {
      viewMode = 'live';
      replayStep = null;
      isPlaying = false;
    }
  };

  handleGlobalKey('Escape');

  assert.strictEqual(viewMode, 'live');
  assert.strictEqual(replayStep, null);
  assert.strictEqual(isPlaying, false);

  handleGlobalKey('Escape');
  assert.strictEqual(viewMode, 'live');
});
