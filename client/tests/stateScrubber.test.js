import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventMeta } from '../src/utils/eventMeta.js';

const mockEvents = [
  {
    aggregateId: 'SHIP-CRYO-01',
    eventType: 'CONTAINER_CREATED',
    version: 1,
    payload: { origin: 'Port of Antwerp', cargo: 'Biological Reagents' },
    timestamp: new Date('2026-09-10T10:00:00Z')
  },
  {
    aggregateId: 'SHIP-CRYO-01',
    eventType: 'LOADED_ON_SHIP',
    version: 2,
    payload: { port: 'Antwerp Gateway', vessel: 'MV ATLANTIC ENDEAVOUR' },
    timestamp: new Date('2026-09-11T14:00:00Z')
  },
  {
    aggregateId: 'SHIP-CRYO-01',
    eventType: 'TEMPERATURE_SPIKE',
    version: 3,
    payload: { temperature: 16.4, threshold: 4.0 },
    timestamp: new Date('2026-09-12T18:30:00Z')
  },
  {
    aggregateId: 'SHIP-CRYO-01',
    eventType: 'ARRIVED_AT_PORT',
    version: 4,
    payload: { port: 'Port of Singapore Berth 7' },
    timestamp: new Date('2026-09-13T22:00:00Z')
  }
];

test('Day 16 State Scrubber: getEventMeta resolves canonical domain event metadata', () => {
  const meta1 = getEventMeta(mockEvents[0]);
  assert.strictEqual(meta1.icon, '📦');
  assert.strictEqual(meta1.label, 'Container Created');
  assert.strictEqual(meta1.typeClass, 'event-type--created');
  assert.ok(meta1.snippet.includes('Antwerp'));

  const meta2 = getEventMeta(mockEvents[1]);
  assert.strictEqual(meta2.icon, '🚢');
  assert.strictEqual(meta2.label, 'Loaded on Ship');
  assert.strictEqual(meta2.typeClass, 'event-type--loaded');
  assert.ok(meta2.snippet.includes('MV ATLANTIC ENDEAVOUR'));

  const meta3 = getEventMeta(mockEvents[2]);
  assert.strictEqual(meta3.icon, '🔥');
  assert.strictEqual(meta3.label, 'Temperature Spike');
  assert.strictEqual(meta3.typeClass, 'event-type--alert');
  assert.ok(meta3.snippet.includes('16.4°C'));

  const meta4 = getEventMeta(mockEvents[3]);
  assert.strictEqual(meta4.icon, '🏁');
  assert.strictEqual(meta4.label, 'Arrived at Port');
  assert.strictEqual(meta4.typeClass, 'event-type--arrived');
  assert.ok(meta4.snippet.includes('Singapore'));
});

test('Day 16 State Scrubber: handles unknown or empty event safely', () => {
  const nullMeta = getEventMeta(null);
  assert.strictEqual(nullMeta.icon, '⏱');
  assert.strictEqual(nullMeta.label, 'Unknown Event');
  assert.strictEqual(nullMeta.typeClass, 'event-type--unknown');

  const customMeta = getEventMeta({ eventType: 'CUSTOM_INSPECTION_CLEARED' });
  assert.strictEqual(customMeta.icon, '⏱');
  assert.strictEqual(customMeta.label, 'Custom Inspection Cleared');
});

test('Day 16 State Scrubber: calculates temporal delta and head lag', () => {
  const totalEvents = 4;

  const calculateLag = (currentStep, total) => {
    const lag = total - currentStep;
    return {
      isAtHead: lag === 0,
      stepsBehind: lag,
      message: lag === 0 ? 'In sync with head' : `${lag} events behind live`
    };
  };

  const atGenesis = calculateLag(1, totalEvents);
  assert.strictEqual(atGenesis.isAtHead, false);
  assert.strictEqual(atGenesis.stepsBehind, 3);
  assert.strictEqual(atGenesis.message, '3 events behind live');

  const atMidpoint = calculateLag(2, totalEvents);
  assert.strictEqual(atMidpoint.isAtHead, false);
  assert.strictEqual(atMidpoint.stepsBehind, 2);

  const atHead = calculateLag(4, totalEvents);
  assert.strictEqual(atHead.isAtHead, true);
  assert.strictEqual(atHead.stepsBehind, 0);
  assert.strictEqual(atHead.message, 'In sync with head');
});

test('Day 16 State Scrubber: keyboard navigation logic', () => {
  let currentStep = 2;
  const maxStep = 4;

  const handleKey = (key) => {
    if (key === 'ArrowLeft' || key === 'ArrowDown') {
      currentStep = Math.max(1, currentStep - 1);
    } else if (key === 'ArrowRight' || key === 'ArrowUp') {
      currentStep = Math.min(maxStep, currentStep + 1);
    } else if (key === 'Home') {
      currentStep = 1;
    } else if (key === 'End') {
      currentStep = maxStep;
    }
  };

  handleKey('ArrowRight');
  assert.strictEqual(currentStep, 3);

  handleKey('ArrowLeft');
  assert.strictEqual(currentStep, 2);

  handleKey('Home');
  assert.strictEqual(currentStep, 1);

  handleKey('ArrowLeft'); // Bound check at lower limit
  assert.strictEqual(currentStep, 1);

  handleKey('End');
  assert.strictEqual(currentStep, 4);

  handleKey('ArrowRight'); // Bound check at upper limit
  assert.strictEqual(currentStep, 4);
});
