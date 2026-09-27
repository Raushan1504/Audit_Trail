import test from 'node:test';
import assert from 'node:assert/strict';

// Canonical event types from backend contract
const EVENT_TYPES = {
  CONTAINER_CREATED: 'CONTAINER_CREATED',
  LOADED_ON_SHIP: 'LOADED_ON_SHIP',
  TEMPERATURE_SPIKE: 'TEMPERATURE_SPIKE',
  ARRIVED_AT_PORT: 'ARRIVED_AT_PORT'
};

// Pure Event Sourcing fold/reducer mirroring domain replay for forensic verification
function replayEvents(events) {
  const initialState = {
    shipmentId: null,
    status: 'UNKNOWN',
    location: null,
    temperature: null,
    vessel: null,
    cargo: null,
    version: 0,
    history: []
  };

  return events.reduce((state, event) => {
    const nextState = { ...state, version: event.version };
    nextState.history = [...state.history, event.eventType];

    switch (event.eventType) {
      case EVENT_TYPES.CONTAINER_CREATED:
        nextState.shipmentId = event.aggregateId;
        nextState.status = 'CREATED';
        nextState.location = event.payload?.origin || 'Origin Facility';
        nextState.cargo = event.payload?.cargo || 'General Freight';
        break;

      case EVENT_TYPES.LOADED_ON_SHIP:
        nextState.status = 'LOADED';
        nextState.location = event.payload?.port || state.location;
        nextState.vessel = event.payload?.vessel || 'Vessel 01';
        break;

      case EVENT_TYPES.TEMPERATURE_SPIKE:
        nextState.status = 'ALERT';
        nextState.temperature = event.payload?.temperature ?? 15;
        break;

      case EVENT_TYPES.ARRIVED_AT_PORT:
        nextState.status = 'ARRIVED';
        nextState.location = event.payload?.port || 'Destination Port';
        break;

      default:
        break;
    }

    return nextState;
  }, initialState);
}

// Forensic Workflow Integration Simulator: Search -> Fetch Events -> Replay State -> UI Model
function runForensicInvestigation(searchQuery, mockEventStore) {
  const sanitizedQuery = (searchQuery || '').trim().toUpperCase();

  if (!sanitizedQuery) {
    throw new Error('Search query cannot be empty');
  }

  const events = mockEventStore[sanitizedQuery];
  if (!events || events.length === 0) {
    const notFoundError = new Error(`Shipment ${sanitizedQuery} not found in Event Store`);
    notFoundError.status = 404;
    throw notFoundError;
  }

  // 1. Verify append-only chronological order
  const sortedEvents = [...events].sort((a, b) => a.version - b.version);
  for (let i = 0; i < sortedEvents.length; i++) {
    if (sortedEvents[i].version !== i + 1) {
      throw new Error(`Tampering detected: version gap at event index ${i}`);
    }
  }

  // 2. Replay events into current state
  const reconstructedState = replayEvents(sortedEvents);

  // 3. Generate Forensic Dashboard UI Payload
  const uiPresentation = {
    header: {
      shipmentId: sanitizedQuery,
      status: reconstructedState.status,
      version: reconstructedState.version,
      isReconstructed: true,
      immutableVerified: true
    },
    stateCard: {
      status: reconstructedState.status,
      location: reconstructedState.location,
      vessel: reconstructedState.vessel,
      temperature: reconstructedState.temperature,
      cargo: reconstructedState.cargo,
      eventCount: sortedEvents.length
    },
    timeline: sortedEvents.map((e) => ({
      version: e.version,
      eventType: e.eventType,
      timestamp: e.timestamp,
      payload: e.payload,
      isImmutable: true
    }))
  };

  return uiPresentation;
}

test('Forensic Dashboard Workflow — End-to-End Investigation', async (t) => {
  const mockEventStore = {
    'SHIP-PACIFIC-99': [
      {
        aggregateId: 'SHIP-PACIFIC-99',
        eventType: EVENT_TYPES.CONTAINER_CREATED,
        version: 1,
        timestamp: new Date('2026-09-01T08:00:00Z'),
        payload: { origin: 'Port of Yokohama', cargo: 'Semiconductor Wafers' }
      },
      {
        aggregateId: 'SHIP-PACIFIC-99',
        eventType: EVENT_TYPES.LOADED_ON_SHIP,
        version: 2,
        timestamp: new Date('2026-09-02T12:30:00Z'),
        payload: { port: 'Yokohama Terminal 2', vessel: 'MV PACIFIC STAR' }
      },
      {
        aggregateId: 'SHIP-PACIFIC-99',
        eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
        version: 3,
        timestamp: new Date('2026-09-05T16:45:00Z'),
        payload: { temperature: 14.5, threshold: 4.0 }
      },
      {
        aggregateId: 'SHIP-PACIFIC-99',
        eventType: EVENT_TYPES.ARRIVED_AT_PORT,
        version: 4,
        timestamp: new Date('2026-09-10T09:15:00Z'),
        payload: { port: 'Port of Long Beach' }
      }
    ]
  };

  await t.test('executes Search -> API -> Events -> Replay -> UI Presentation', () => {
    const result = runForensicInvestigation('ship-pacific-99', mockEventStore);

    // Verify UI Presentation Output
    assert.strictEqual(result.header.shipmentId, 'SHIP-PACIFIC-99');
    assert.strictEqual(result.header.status, 'ARRIVED');
    assert.strictEqual(result.header.version, 4);
    assert.strictEqual(result.header.isReconstructed, true);
    assert.strictEqual(result.header.immutableVerified, true);

    // Verify State Card Values Reconstructed from Events
    assert.strictEqual(result.stateCard.location, 'Port of Long Beach');
    assert.strictEqual(result.stateCard.vessel, 'MV PACIFIC STAR');
    assert.strictEqual(result.stateCard.temperature, 14.5);
    assert.strictEqual(result.stateCard.cargo, 'Semiconductor Wafers');
    assert.strictEqual(result.stateCard.eventCount, 4);

    // Verify Chronological Timeline Integrity
    assert.strictEqual(result.timeline.length, 4);
    assert.strictEqual(result.timeline[0].eventType, EVENT_TYPES.CONTAINER_CREATED);
    assert.strictEqual(result.timeline[1].eventType, EVENT_TYPES.LOADED_ON_SHIP);
    assert.strictEqual(result.timeline[2].eventType, EVENT_TYPES.TEMPERATURE_SPIKE);
    assert.strictEqual(result.timeline[3].eventType, EVENT_TYPES.ARRIVED_AT_PORT);
    assert.strictEqual(result.timeline[3].version, 4);
  });

  await t.test('raises 404 error when querying an unrecorded shipment', () => {
    assert.throws(
      () => runForensicInvestigation('SHIP-NON-EXISTENT', mockEventStore),
      (err) => err.status === 404 && err.message.includes('not found')
    );
  });

  await t.test('raises error if empty search query is supplied', () => {
    assert.throws(
      () => runForensicInvestigation('   ', mockEventStore),
      /Search query cannot be empty/
    );
  });

  await t.test('detects tampered non-contiguous version sequences in event stream', () => {
    const tamperedStore = {
      'SHIP-TAMPERED': [
        { aggregateId: 'SHIP-TAMPERED', eventType: EVENT_TYPES.CONTAINER_CREATED, version: 1 },
        { aggregateId: 'SHIP-TAMPERED', eventType: EVENT_TYPES.ARRIVED_AT_PORT, version: 3 } // Version 2 missing
      ]
    };

    assert.throws(
      () => runForensicInvestigation('SHIP-TAMPERED', tamperedStore),
      /Tampering detected: version gap/
    );
  });
});
