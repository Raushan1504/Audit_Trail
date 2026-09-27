import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Playback Controller simulating Day 19 automated step-by-step playback engine
 */
class PlaybackController {
  constructor(totalEvents = 4, initialStep = 4) {
    this.totalEvents = Math.max(1, totalEvents);
    this.currentStep = initialStep;
    this.viewMode = 'live'; // 'live' | 'historical'
    this.isPlaying = false;
    this.speed = 1.0;
    this.isLooping = false;
    this.playbackHistory = [];
  }

  getIntervalMs() {
    return Math.round(1200 / this.speed);
  }

  play() {
    if (this.viewMode === 'live') {
      this.viewMode = 'historical';
      if (this.currentStep >= this.totalEvents) {
        this.currentStep = 1;
      }
    } else if (this.currentStep >= this.totalEvents) {
      this.currentStep = 1;
    }
    this.isPlaying = true;
    this.playbackHistory.push(this.currentStep);
  }

  pause() {
    this.isPlaying = false;
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  rewind() {
    this.currentStep = 1;
    this.playbackHistory.push(1);
  }

  stepNext() {
    this.pause();
    if (this.currentStep < this.totalEvents) {
      this.currentStep += 1;
      this.playbackHistory.push(this.currentStep);
    }
  }

  stepPrev() {
    this.pause();
    if (this.currentStep > 1) {
      this.currentStep -= 1;
      this.playbackHistory.push(this.currentStep);
    }
  }

  setSpeed(newSpeed) {
    if ([0.5, 1.0, 2.0].includes(newSpeed)) {
      this.speed = newSpeed;
    }
  }

  toggleLoop() {
    this.isLooping = !this.isLooping;
  }

  // Simulate one playback tick
  tick() {
    if (!this.isPlaying) return;

    if (this.currentStep < this.totalEvents) {
      this.currentStep += 1;
      this.playbackHistory.push(this.currentStep);
    } else {
      if (this.isLooping) {
        this.currentStep = 1;
        this.playbackHistory.push(1);
      } else {
        this.isPlaying = false;
      }
    }
  }

  returnToLive() {
    this.isPlaying = false;
    this.viewMode = 'live';
    this.currentStep = this.totalEvents;
  }
}

test('Day 19 Step-by-Step Playback: Controller Initialization & Speed Calculation', async (t) => {
  await t.test('initializes with default playback state and stopped timers', () => {
    const player = new PlaybackController(4, 4);

    assert.strictEqual(player.isPlaying, false);
    assert.strictEqual(player.currentStep, 4);
    assert.strictEqual(player.viewMode, 'live');
    assert.strictEqual(player.speed, 1.0);
    assert.strictEqual(player.isLooping, false);
    assert.strictEqual(player.getIntervalMs(), 1200);
  });

  await t.test('calculates interval durations across playback speed presets', () => {
    const player = new PlaybackController(4, 1);

    player.setSpeed(0.5);
    assert.strictEqual(player.speed, 0.5);
    assert.strictEqual(player.getIntervalMs(), 2400);

    player.setSpeed(1.0);
    assert.strictEqual(player.speed, 1.0);
    assert.strictEqual(player.getIntervalMs(), 1200);

    player.setSpeed(2.0);
    assert.strictEqual(player.speed, 2.0);
    assert.strictEqual(player.getIntervalMs(), 600);
  });
});

test('Day 19 Step-by-Step Playback: Play, Pause, and Rewind Lifecycle', async (t) => {
  await t.test('starts playback from head by auto-rewinding to Genesis version 1', () => {
    const player = new PlaybackController(4, 4);

    player.play();
    assert.strictEqual(player.isPlaying, true);
    assert.strictEqual(player.viewMode, 'historical');
    assert.strictEqual(player.currentStep, 1);
  });

  await t.test('advances versions on sequential playback ticks', () => {
    const player = new PlaybackController(4, 1);
    player.play();

    assert.strictEqual(player.currentStep, 1);

    player.tick();
    assert.strictEqual(player.currentStep, 2);

    player.tick();
    assert.strictEqual(player.currentStep, 3);

    player.tick();
    assert.strictEqual(player.currentStep, 4);

    // Terminal step reached with loop false -> automatically pauses
    player.tick();
    assert.strictEqual(player.isPlaying, false);
    assert.strictEqual(player.currentStep, 4);
  });

  await t.test('pause halts playback at intermediate version without losing position', () => {
    const player = new PlaybackController(4, 1);
    player.play();
    player.tick(); // Step 2

    assert.strictEqual(player.currentStep, 2);
    player.pause();
    assert.strictEqual(player.isPlaying, false);

    // Subsequent tick when paused should not mutate step
    player.tick();
    assert.strictEqual(player.currentStep, 2);
  });

  await t.test('rewind immediately jumps back to Genesis version 1', () => {
    const player = new PlaybackController(4, 3);
    player.rewind();

    assert.strictEqual(player.currentStep, 1);
  });
});

test('Day 19 Step-by-Step Playback: Loop Mode & Boundary Wrap-Around', async (t) => {
  await t.test('loops back to Version 1 when reaching terminal step with loop enabled', () => {
    const player = new PlaybackController(3, 1);
    player.toggleLoop();
    assert.strictEqual(player.isLooping, true);

    player.play();
    assert.strictEqual(player.currentStep, 1);

    player.tick(); // step 2
    assert.strictEqual(player.currentStep, 2);

    player.tick(); // step 3 (terminal)
    assert.strictEqual(player.currentStep, 3);

    // Tick at terminal step with loop enabled wraps to 1 and keeps playing
    player.tick();
    assert.strictEqual(player.currentStep, 1);
    assert.strictEqual(player.isPlaying, true);
  });
});

test('Day 19 Step-by-Step Playback: Manual Navigation & Live Mode Interop', async (t) => {
  await t.test('stepping forward or backward pauses automated playback', () => {
    const player = new PlaybackController(4, 2);
    player.play();
    assert.strictEqual(player.isPlaying, true);

    player.stepNext();
    assert.strictEqual(player.isPlaying, false);
    assert.strictEqual(player.currentStep, 3);

    player.stepPrev();
    assert.strictEqual(player.isPlaying, false);
    assert.strictEqual(player.currentStep, 2);
  });

  await t.test('returning to live mode stops playback and restores head state', () => {
    const player = new PlaybackController(4, 1);
    player.play();
    assert.strictEqual(player.isPlaying, true);

    player.returnToLive();
    assert.strictEqual(player.isPlaying, false);
    assert.strictEqual(player.viewMode, 'live');
    assert.strictEqual(player.currentStep, 4);
  });
});
