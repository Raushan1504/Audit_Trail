import test from 'node:test';
import assert from 'node:assert/strict';

const mockEvents = [
  {
    aggregateId: 'SHIP-FORENSIC-01',
    eventType: 'CONTAINER_CREATED',
    version: 1,
    payload: { origin: 'Port of Shanghai', cargo: 'Semiconductor Wafers', destination: 'Port of Rotterdam' },
    timestamp: new Date('2026-09-01T08:00:00Z')
  },
  {
    aggregateId: 'SHIP-FORENSIC-01',
    eventType: 'LOADED_ON_SHIP',
    version: 2,
    payload: { port: 'Shanghai Terminal Berth 3', vessel: 'MV OCEAN TITAN' },
    timestamp: new Date('2026-09-02T12:00:00Z')
  },
  {
    aggregateId: 'SHIP-FORENSIC-01',
    eventType: 'TEMPERATURE_SPIKE',
    version: 3,
    payload: { temperature: 14.5, threshold: 4.0, sensorId: 'SN-TH-99' },
    timestamp: new Date('2026-09-04T15:30:00Z')
  },
  {
    aggregateId: 'SHIP-FORENSIC-01',
    eventType: 'ARRIVED_AT_PORT',
    version: 4,
    payload: { port: 'Port of Rotterdam Gateway' },
    timestamp: new Date('2026-09-06T09:00:00Z')
  }
];

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

/**
 * Controller simulating Day 20 timeline card click and jump behavior
 */
class TimelineJumpController {
  constructor(events = [], initialStep = null) {
    this.events = events;
    this.currentReplayStep = initialStep;
    this.viewMode = initialStep !== null ? 'historical' : 'live';
    this.isPlaying = false;
    this.jumpHistory = [];
  }

  jumpToEvent(stepNumber) {
    if (stepNumber < 1 || stepNumber > this.events.length) {
      throw new Error(`Invalid jump target step: ${stepNumber}`);
    }
    this.isPlaying = false;
    this.viewMode = 'historical';
    this.currentReplayStep = stepNumber;
    this.jumpHistory.push(stepNumber);
    return this.getReconstructedState();
  }

  getActiveStepIndex() {
    return this.currentReplayStep !== null ? this.currentReplayStep - 1 : this.events.length - 1;
  }

  isCardActive(cardIndex) {
    if (this.currentReplayStep === null) return false;
    return cardIndex + 1 === this.currentReplayStep;
  }

  getReconstructedState() {
    return foldEventsUpTo(this.events, this.currentReplayStep);
  }

  resetToLive() {
    this.isPlaying = false;
    this.viewMode = 'live';
    this.currentReplayStep = null;
  }
}

test('Day 20 Timeline Event Jump: Click Interaction & Step Transition', async (t) => {
  await t.test('clicking Genesis card (v1) immediately jumps scrubber and reconstructs initial state', () => {
    const controller = new TimelineJumpController(mockEvents);

    const state = controller.jumpToEvent(1);
    assert.strictEqual(controller.currentReplayStep, 1);
    assert.strictEqual(controller.viewMode, 'historical');
    assert.strictEqual(state.version, 1);
    assert.strictEqual(state.status, 'CREATED');
    assert.strictEqual(state.location, 'Port of Shanghai');
    assert.strictEqual(state.vessel, null);
  });

  await t.test('clicking intermediate Anomaly card (v3) jumps scrubber directly to thermal spike', () => {
    const controller = new TimelineJumpController(mockEvents);

    const state = controller.jumpToEvent(3);
    assert.strictEqual(controller.currentReplayStep, 3);
    assert.strictEqual(state.version, 3);
    assert.strictEqual(state.status, 'ALERT');
    assert.strictEqual(state.temperature, 14.5);
    assert.strictEqual(state.vessel, 'MV OCEAN TITAN');
  });

  await t.test('clicking terminal card (v4) jumps scrubber to port arrival', () => {
    const controller = new TimelineJumpController(mockEvents);

    const state = controller.jumpToEvent(4);
    assert.strictEqual(controller.currentReplayStep, 4);
    assert.strictEqual(state.version, 4);
    assert.strictEqual(state.status, 'ARRIVED');
    assert.strictEqual(state.location, 'Port of Rotterdam Gateway');
  });

  await t.test('rejects out-of-bounds jump steps with clear error', () => {
    const controller = new TimelineJumpController(mockEvents);

    assert.throws(() => controller.jumpToEvent(0), /Invalid jump target step/);
    assert.throws(() => controller.jumpToEvent(99), /Invalid jump target step/);
  });
});

test('Day 20 Timeline Event Jump: Active Card Highlighting & Visual Synchronization', async (t) => {
  await t.test('correctly identifies the single active card matching current scrubber position', () => {
    const controller = new TimelineJumpController(mockEvents, 2);

    assert.strictEqual(controller.isCardActive(0), false, 'Card 0 (v1) should not be active');
    assert.strictEqual(controller.isCardActive(1), true, 'Card 1 (v2) should be active');
    assert.strictEqual(controller.isCardActive(2), false, 'Card 2 (v3) should not be active');
    assert.strictEqual(controller.isCardActive(3), false, 'Card 3 (v4) should not be active');
  });

  await t.test('clicking an event halts active automated playback simulation', () => {
    const controller = new TimelineJumpController(mockEvents);
    controller.isPlaying = true;

    controller.jumpToEvent(2);
    assert.strictEqual(controller.isPlaying, false, 'Playback should halt when jump is clicked');
    assert.strictEqual(controller.currentReplayStep, 2);
  });

  await t.test('reset to live head clears specific card focus', () => {
    const controller = new TimelineJumpController(mockEvents, 2);
    assert.strictEqual(controller.isCardActive(1), true);

    controller.resetToLive();
    assert.strictEqual(controller.currentReplayStep, null);
    assert.strictEqual(controller.isCardActive(1), false);
    assert.strictEqual(controller.viewMode, 'live');
  });
});
