import test from 'node:test';
import assert from 'node:assert/strict';

// Helper reproducing the deterministic folding logic
function foldEventsUpTo(events, step) {
  if (!Array.isArray(events) || events.length === 0) return null;
  const slice = step !== null ? events.slice(0, step) : events;

  const initialState = {
    shipmentId: null,
    status: 'UNKNOWN',
    location: null,
    temperature: null,
    vessel: null,
    cargo: null,
    version: 0
  };

  return slice.reduce((state, event) => {
    const next = { ...state, version: event.version };
    const type = event.eventType;

    if (type === 'CONTAINER_CREATED') {
      next.shipmentId = event.aggregateId;
      next.status = 'CREATED';
      next.location = event.payload?.origin || 'Origin Facility';
      next.cargo = event.payload?.cargo;
    } else if (type === 'LOADED_ON_SHIP') {
      next.status = 'LOADED';
      next.location = event.payload?.port || state.location;
      next.vessel = event.payload?.vessel || 'Vessel 01';
    } else if (type === 'TEMPERATURE_SPIKE') {
      next.status = 'ALERT';
      next.temperature = event.payload?.temperature;
    } else if (type === 'ARRIVED_AT_PORT') {
      next.status = 'ARRIVED';
      next.location = event.payload?.port || state.location;
    }
    return next;
  }, initialState);
}

// Simulates the timeline event partition based on the scrubbed step
function partitionTimelineEvents(events, currentStep) {
  if (!Array.isArray(events)) return { applied: [], current: null, future: [] };
  if (currentStep === null || currentStep >= events.length) {
    return {
      applied: events,
      current: events[events.length - 1] || null,
      future: []
    };
  }

  return {
    applied: events.slice(0, currentStep),
    current: events[currentStep - 1] || null,
    future: events.slice(currentStep)
  };
}

const mockEvents = [
  {
    aggregateId: 'SHIP-BIND-01',
    eventType: 'CONTAINER_CREATED',
    version: 1,
    payload: { origin: 'Port of Rotterdam', cargo: 'Semiconductor Wafers' },
    timestamp: new Date('2026-09-15T08:00:00Z')
  },
  {
    aggregateId: 'SHIP-BIND-01',
    eventType: 'LOADED_ON_SHIP',
    version: 2,
    payload: { port: 'Rotterdam Terminal A', vessel: 'MV PACIFIC LEADER' },
    timestamp: new Date('2026-09-16T12:00:00Z')
  },
  {
    aggregateId: 'SHIP-BIND-01',
    eventType: 'TEMPERATURE_SPIKE',
    version: 3,
    payload: { temperature: 15.6, threshold: 4.0 },
    timestamp: new Date('2026-09-17T15:30:00Z')
  },
  {
    aggregateId: 'SHIP-BIND-01',
    eventType: 'ARRIVED_AT_PORT',
    version: 4,
    payload: { port: 'Port of Singapore Berth 4' },
    timestamp: new Date('2026-09-18T19:00:00Z')
  }
];

test('Day 17 Temporal Binding: slider step 1 reconstructs Genesis container state', () => {
  const state = foldEventsUpTo(mockEvents, 1);
  assert.strictEqual(state.version, 1);
  assert.strictEqual(state.status, 'CREATED');
  assert.strictEqual(state.location, 'Port of Rotterdam');
  assert.strictEqual(state.cargo, 'Semiconductor Wafers');
  assert.strictEqual(state.vessel, null);
  assert.strictEqual(state.temperature, null);
});

test('Day 17 Temporal Binding: slider step 2 transitions to loaded ocean transit', () => {
  const state = foldEventsUpTo(mockEvents, 2);
  assert.strictEqual(state.version, 2);
  assert.strictEqual(state.status, 'LOADED');
  assert.strictEqual(state.location, 'Rotterdam Terminal A');
  assert.strictEqual(state.vessel, 'MV PACIFIC LEADER');
  assert.strictEqual(state.temperature, null);
});

test('Day 17 Temporal Binding: slider step 3 reflects anomaly temperature spike', () => {
  const state = foldEventsUpTo(mockEvents, 3);
  assert.strictEqual(state.version, 3);
  assert.strictEqual(state.status, 'ALERT');
  assert.strictEqual(state.temperature, 15.6);
  assert.strictEqual(state.vessel, 'MV PACIFIC LEADER');
});

test('Day 17 Temporal Binding: slider step 4 reflects terminal port arrival', () => {
  const state = foldEventsUpTo(mockEvents, 4);
  assert.strictEqual(state.version, 4);
  assert.strictEqual(state.status, 'ARRIVED');
  assert.strictEqual(state.location, 'Port of Singapore Berth 4');
  assert.strictEqual(state.vessel, 'MV PACIFIC LEADER');
});

test('Day 17 Temporal Binding: partitions timeline into past, current head, and future events', () => {
  // When scrubbed to step 2:
  const p = partitionTimelineEvents(mockEvents, 2);
  assert.strictEqual(p.applied.length, 2);
  assert.strictEqual(p.current.version, 2);
  assert.strictEqual(p.current.eventType, 'LOADED_ON_SHIP');
  assert.strictEqual(p.future.length, 2);
  assert.strictEqual(p.future[0].eventType, 'TEMPERATURE_SPIKE');
  assert.strictEqual(p.future[1].eventType, 'ARRIVED_AT_PORT');

  // When reset to live state (null step):
  const live = partitionTimelineEvents(mockEvents, null);
  assert.strictEqual(live.applied.length, 4);
  assert.strictEqual(live.future.length, 0);
  assert.strictEqual(live.current.version, 4);
});
