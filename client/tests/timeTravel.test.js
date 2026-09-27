import test from 'node:test';
import assert from 'node:assert/strict';

// Helper extracting client-side event fold logic
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

// Helper simulating TimeSlider mode and step manager
class TimeTravelController {
  constructor(events = []) {
    this.events = events;
    this.viewMode = 'live'; // 'live' | 'historical'
    this.currentStep = events.length;
  }

  setMode(mode) {
    if (mode === 'live') {
      this.viewMode = 'live';
      this.currentStep = this.events.length;
    } else if (mode === 'historical') {
      this.viewMode = 'historical';
      if (!this.currentStep || this.currentStep < 1) {
        this.currentStep = this.events.length;
      }
    }
  }

  setStep(step) {
    this.viewMode = 'historical';
    const clamped = Math.max(1, Math.min(step, this.events.length));
    this.currentStep = clamped;
  }

  stepPrev() {
    if (this.currentStep > 1) {
      this.setStep(this.currentStep - 1);
    }
  }

  stepNext() {
    if (this.currentStep < this.events.length) {
      this.setStep(this.currentStep + 1);
    }
  }

  jumpGenesis() {
    this.setStep(1);
  }

  jumpLatest() {
    this.setStep(this.events.length);
  }

  getDisplayedState() {
    if (this.viewMode === 'live') {
      return foldEventsUpTo(this.events, null);
    }
    return foldEventsUpTo(this.events, this.currentStep);
  }

  isPastSnapshot() {
    return this.viewMode === 'historical' && this.currentStep < this.events.length;
  }
}

const mockShipmentEvents = [
  {
    aggregateId: 'SHIP-TEST-99',
    eventType: 'CONTAINER_CREATED',
    version: 1,
    payload: { origin: 'Port of Hamburg', cargo: 'Cryogenic Enzymes' },
    timestamp: new Date('2026-09-01T08:00:00Z')
  },
  {
    aggregateId: 'SHIP-TEST-99',
    eventType: 'LOADED_ON_SHIP',
    version: 2,
    payload: { port: 'Hamburg Marine Hub', vessel: 'MV ARCTIC VOYAGER' },
    timestamp: new Date('2026-09-02T12:00:00Z')
  },
  {
    aggregateId: 'SHIP-TEST-99',
    eventType: 'TEMPERATURE_SPIKE',
    version: 3,
    payload: { temperature: 14.8, threshold: 4.0 },
    timestamp: new Date('2026-09-03T16:30:00Z')
  },
  {
    aggregateId: 'SHIP-TEST-99',
    eventType: 'ARRIVED_AT_PORT',
    version: 4,
    payload: { port: 'Port of Rotterdam Terminal 3' },
    timestamp: new Date('2026-09-04T20:00:00Z')
  }
];

test('Day 15 Time-Travel: default view mode is live current state', () => {
  const ctrl = new TimeTravelController(mockShipmentEvents);

  assert.strictEqual(ctrl.viewMode, 'live');
  assert.strictEqual(ctrl.isPastSnapshot(), false);

  const state = ctrl.getDisplayedState();
  assert.strictEqual(state.status, 'ARRIVED');
  assert.strictEqual(state.version, 4);
  assert.strictEqual(state.location, 'Port of Rotterdam Terminal 3');
  assert.strictEqual(state.vessel, 'MV ARCTIC VOYAGER');
  assert.strictEqual(state.temperature, 14.8);
});

test('Day 15 Time-Travel: toggles to historical inspection mode and rewinds state', () => {
  const ctrl = new TimeTravelController(mockShipmentEvents);

  ctrl.setMode('historical');
  assert.strictEqual(ctrl.viewMode, 'historical');

  // Rewind to Genesis (v1)
  ctrl.jumpGenesis();
  assert.strictEqual(ctrl.currentStep, 1);
  assert.strictEqual(ctrl.isPastSnapshot(), true);

  const v1State = ctrl.getDisplayedState();
  assert.strictEqual(v1State.status, 'CREATED');
  assert.strictEqual(v1State.version, 1);
  assert.strictEqual(v1State.location, 'Port of Hamburg');
  assert.strictEqual(v1State.vessel, null);
  assert.strictEqual(v1State.temperature, null);
  assert.strictEqual(v1State.cargo, 'Cryogenic Enzymes');
});

test('Day 15 Time-Travel: step navigation handles intermediate snapshots', () => {
  const ctrl = new TimeTravelController(mockShipmentEvents);

  // Rewind to v1 then step forward to v2 (LOADED)
  ctrl.jumpGenesis();
  ctrl.stepNext();
  assert.strictEqual(ctrl.currentStep, 2);

  const v2State = ctrl.getDisplayedState();
  assert.strictEqual(v2State.status, 'LOADED');
  assert.strictEqual(v2State.version, 2);
  assert.strictEqual(v2State.vessel, 'MV ARCTIC VOYAGER');
  assert.strictEqual(v2State.temperature, null);

  // Step forward to v3 (TEMPERATURE_SPIKE)
  ctrl.stepNext();
  assert.strictEqual(ctrl.currentStep, 3);

  const v3State = ctrl.getDisplayedState();
  assert.strictEqual(v3State.status, 'ALERT');
  assert.strictEqual(v3State.version, 3);
  assert.strictEqual(v3State.temperature, 14.8);
});

test('Day 15 Time-Travel: prevents out-of-bounds slider inputs', () => {
  const ctrl = new TimeTravelController(mockShipmentEvents);

  // Clamps negative or zero to 1
  ctrl.setStep(-5);
  assert.strictEqual(ctrl.currentStep, 1);

  // Clamps greater than event count to max
  ctrl.setStep(999);
  assert.strictEqual(ctrl.currentStep, 4);
});

test('Day 15 Time-Travel: returns to live operational state cleanly', () => {
  const ctrl = new TimeTravelController(mockShipmentEvents);

  ctrl.setMode('historical');
  ctrl.jumpGenesis();
  assert.strictEqual(ctrl.isPastSnapshot(), true);

  // Switch back to live mode
  ctrl.setMode('live');
  assert.strictEqual(ctrl.viewMode, 'live');
  assert.strictEqual(ctrl.isPastSnapshot(), false);

  const liveState = ctrl.getDisplayedState();
  assert.strictEqual(liveState.version, 4);
  assert.strictEqual(liveState.status, 'ARRIVED');
});
