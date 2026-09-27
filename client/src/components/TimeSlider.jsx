import { useState, useEffect } from 'react';
import { getEventMeta, formatEventName } from '../utils/eventMeta';
import './TimeSlider.css';

/**
 * TimeSlider Component (Day 15, Day 16, Day 17, Day 19)
 *
 * Provides granular state scrubbing and automated step-by-step playback controls (Play/Pause/Rewind)
 * allowing logistics analysts to watch historical domain events fold in real time.
 */
function TimeSlider({
  viewMode = 'live',
  onViewModeChange,
  totalEvents = 0,
  currentStep = 1,
  onStepChange,
  events = [],
  isPlaying: externalIsPlaying,
  onPlayToggle,
  playbackSpeed: externalSpeed,
  onSpeedChange,
  isLooping: externalLoop,
  onLoopToggle
}) {
  const [hoveredStep, setHoveredStep] = useState(null);

  // Internal playback state if not controlled externally
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [internalSpeed, setInternalSpeed] = useState(1);
  const [internalLoop, setInternalLoop] = useState(false);

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const playbackSpeed = externalSpeed !== undefined ? externalSpeed : internalSpeed;
  const isLooping = externalLoop !== undefined ? externalLoop : internalLoop;

  const setIsPlaying = (val) => {
    if (onPlayToggle) {
      onPlayToggle(val);
    } else {
      setInternalIsPlaying(val);
    }
  };

  const setPlaybackSpeed = (val) => {
    if (onSpeedChange) {
      onSpeedChange(val);
    } else {
      setInternalSpeed(val);
    }
  };

  const setIsLooping = (val) => {
    if (onLoopToggle) {
      onLoopToggle(val);
    } else {
      setInternalLoop(val);
    }
  };

  const isLive = viewMode === 'live';
  const isHistorical = viewMode === 'historical';
  const maxStep = Math.max(1, totalEvents);
  const activeEvent =
    events && events.length > 0 && currentStep >= 1 && currentStep <= events.length
      ? events[currentStep - 1]
      : null;
  const activeMeta = getEventMeta(activeEvent);
  const stepsBehind = maxStep - currentStep;

  // Automated Step-by-Step Playback Loop
  useEffect(() => {
    if (!isPlaying) return;

    if (viewMode === 'live') {
      setIsPlaying(false);
      return;
    }

    const intervalMs = Math.round(1200 / playbackSpeed);
    const timer = setInterval(() => {
      if (currentStep < maxStep) {
        if (onStepChange) {
          onStepChange(currentStep + 1);
        }
      } else {
        // Reached terminal version of voyage
        if (isLooping) {
          if (onStepChange) {
            onStepChange(1);
          }
        } else {
          setIsPlaying(false);
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, currentStep, maxStep, playbackSpeed, isLooping, viewMode, onStepChange]);

  const handleModeToggle = (targetMode) => {
    if (isPlaying) {
      setIsPlaying(false);
    }
    if (onViewModeChange) {
      onViewModeChange(targetMode);
    }
  };

  const handleSliderChange = (e) => {
    if (isPlaying) {
      setIsPlaying(false);
    }
    const val = parseInt(e.target.value, 10);
    if (onStepChange && !isNaN(val)) {
      onStepChange(val);
    }
  };

  const handleTogglePlay = () => {
    if (viewMode === 'live') {
      if (onViewModeChange) {
        onViewModeChange('historical');
      }
      if (currentStep >= maxStep && onStepChange) {
        onStepChange(1);
      }
      setIsPlaying(true);
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentStep >= maxStep && onStepChange) {
        onStepChange(1);
      }
      setIsPlaying(true);
    }
  };

  const handleRewind = () => {
    if (onStepChange) {
      onStepChange(1);
    }
  };

  const handleStepPrev = () => {
    if (currentStep > 1 && onStepChange) {
      onStepChange(currentStep - 1);
    }
  };

  const handleStepNext = () => {
    if (currentStep < maxStep && onStepChange) {
      onStepChange(currentStep + 1);
    }
  };

  const handleStepPrevWithPause = () => {
    setIsPlaying(false);
    handleStepPrev();
  };

  const handleStepNextWithPause = () => {
    setIsPlaying(false);
    handleStepNext();
  };

  const handleJumpGenesis = () => {
    setIsPlaying(false);
    handleRewind();
  };

  const handleJumpLatest = () => {
    setIsPlaying(false);
    if (onStepChange) {
      onStepChange(maxStep);
    }
  };

  const handleSpeedSelect = (speedVal) => {
    setPlaybackSpeed(speedVal);
  };

  const handleLoopToggle = () => {
    setIsLooping(!isLooping);
  };

  const handleKeyDown = (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      handleTogglePlay();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      handleRewind();
    } else if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      handleLoopToggle();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      handleStepPrevWithPause();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      handleStepNextWithPause();
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleRewind();
    } else if (e.key === 'End') {
      e.preventDefault();
      handleJumpLatest();
    }
  };

  if (totalEvents === 0) {
    return null;
  }

  return (
    <div
      className={`time-travel-bar ${isHistorical ? 'time-travel-bar--historical' : 'time-travel-bar--live'} ${isPlaying ? 'time-travel-bar--playing' : ''}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Shipment Time Travel & Playback Controls"
    >
      <div className="time-travel-bar__glow" />

      {/* Top Controls: Mode Switcher, Quick Play & Status Badges */}
      <div className="time-travel-bar__header">
        <div className="mode-toggle-group" role="group" aria-label="Temporal View Modes">
          <button
            type="button"
            className={`mode-toggle-btn ${isLive ? 'mode-toggle-btn--active' : ''}`}
            onClick={() => handleModeToggle('live')}
            title="Switch to live operational state"
          >
            <span className="live-indicator-dot" />
            <span className="mode-text">Live Current State</span>
          </button>

          <button
            type="button"
            className={`mode-toggle-btn ${isHistorical ? 'mode-toggle-btn--active' : ''}`}
            onClick={() => handleModeToggle('historical')}
            title="Inspect historical state by rewinding events"
          >
            <span className="history-icon">⏮</span>
            <span className="mode-text">Historical Inspection Mode</span>
          </button>
        </div>

        {/* Quick Play/Pause Header Action */}
        <div className="time-travel-bar__quick-playback">
          <button
            type="button"
            className={`quick-play-btn ${isPlaying ? 'quick-play-btn--playing' : ''}`}
            onClick={handleTogglePlay}
            title={isPlaying ? 'Pause automated playback [Space]' : 'Play step-by-step voyage replay [Space]'}
          >
            <span className={`playback-play-icon ${isPlaying ? 'playback-play-icon--pulse' : ''}`}>
              {isPlaying ? '⏸' : currentStep >= maxStep ? '↺' : '▶'}
            </span>
            <span className="quick-play-text">
              {isPlaying ? 'Pause' : currentStep >= maxStep ? 'Replay' : 'Play Voyage'}
            </span>
          </button>
        </div>

        <div className="time-travel-bar__status">
          {isLive ? (
            <div className="live-badge">
              <span className="pulse-beacon" />
              <span className="badge-title">REAL-TIME LEDGER</span>
              <span className="badge-meta">Confirmed Head (v{maxStep})</span>
            </div>
          ) : (
            <div className="historical-badge">
              <span className="warning-icon">⏳</span>
              <span className="badge-title">HISTORICAL SCRUBBER ACTIVE</span>
              <span className="badge-meta">
                Inspecting Version {currentStep} of {maxStep}
              </span>
              {stepsBehind > 0 ? (
                <span className="lag-indicator">
                  ({stepsBehind} {stepsBehind === 1 ? 'event' : 'events'} behind live)
                </span>
              ) : (
                <span className="head-sync-indicator">✓ In sync with head</span>
              )}
              <button
                type="button"
                className="btn-return-live"
                onClick={() => handleModeToggle('live')}
                title="Return to live state"
              >
                Return to Live ⚡
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Day 16 & Day 19: Interactive Scrubber & Step-by-Step Playback Deck */}
      {isHistorical && (
        <div className="time-travel-bar__scrubber">
          {/* Day 19: Full Playback Transport Control Deck */}
          <div className="playback-transport-deck">
            <div className="transport-nav-buttons">
              {/* Rewind */}
              <button
                type="button"
                className="transport-btn transport-btn--rewind"
                onClick={handleRewind}
                title="Rewind to Genesis container creation (Version 1) [R]"
              >
                ⏮ Rewind
              </button>

              {/* Step Prev */}
              <button
                type="button"
                className="transport-btn transport-btn--step"
                onClick={handleStepPrevWithPause}
                disabled={currentStep <= 1}
                title="Step backward one event [◀]"
              >
                ◀ Step
              </button>

              {/* Master Play / Pause */}
              <button
                type="button"
                className={`transport-btn transport-btn--master-play ${isPlaying ? 'transport-btn--playing' : ''}`}
                onClick={handleTogglePlay}
                title={isPlaying ? 'Pause automated playback [Space]' : 'Play step-by-step playback [Space]'}
              >
                <span className={`master-play-icon ${isPlaying ? 'master-play-icon--pulse' : ''}`}>
                  {isPlaying ? '⏸' : currentStep >= maxStep ? '↺' : '▶'}
                </span>
                <span>{isPlaying ? 'Pause' : currentStep >= maxStep ? 'Replay' : 'Play'}</span>
              </button>

              {/* Step Next */}
              <button
                type="button"
                className="transport-btn transport-btn--step"
                onClick={handleStepNextWithPause}
                disabled={currentStep >= maxStep}
                title="Step forward one event [▶]"
              >
                Step ▶
              </button>

              {/* Latest */}
              <button
                type="button"
                className="transport-btn transport-btn--latest"
                onClick={handleJumpLatest}
                disabled={currentStep >= maxStep}
                title="Fast-forward to latest state [End]"
              >
                Latest ⏭
              </button>
            </div>

            {/* Playback Configuration: Speed Selector & Loop Toggle */}
            <div className="playback-config-group">
              <div className="playback-speed-selector" role="group" aria-label="Playback Speed">
                <span className="config-label">SPEED:</span>
                {[0.5, 1, 2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`speed-btn ${playbackSpeed === s ? 'speed-btn--active' : ''}`}
                    onClick={() => handleSpeedSelect(s)}
                    title={`Set playback speed to ${s}x`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={`loop-toggle-btn ${isLooping ? 'loop-toggle-btn--active' : ''}`}
                onClick={handleLoopToggle}
                title="Toggle continuous playback loop [L]"
              >
                <span className="loop-icon">🔁</span>
                <span>Loop {isLooping ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Current Scrubbed Snapshot Meta */}
            <div className="snapshot-meta-card">
              <div className="snapshot-version-tag">
                <span className="version-label">POINT IN TIME:</span>
                <span className="version-value">v{currentStep}</span>
              </div>
              <div className="snapshot-event-info">
                <span className="event-icon">{activeMeta.icon}</span>
                <span className={`event-type-badge ${activeMeta.typeClass}`}>
                  {activeMeta.label}
                </span>
                <span className="event-snippet">{activeMeta.snippet}</span>
                {activeEvent?.timestamp && (
                  <span className="event-time-stamp">
                    {new Date(activeEvent.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Active Automated Playback Ticker Banner */}
          {isPlaying && (
            <div className="playback-active-ticker">
              <div className="ticker-pulse-group">
                <span className="ticker-pulse-dot" />
                <span className="ticker-title">AUTOMATED VOYAGE PLAYBACK ACTIVE</span>
              </div>
              <span className="ticker-status">
                Simulating event stream · Version {currentStep} of {maxStep} ({playbackSpeed}x Speed)
              </span>
              <span className="ticker-hint">Press Space or click Pause to freeze</span>
            </div>
          )}

          {/* Interactive Range Slider with Discrete Event Ticks */}
          <div className="slider-track-container">
            <div className="slider-ticks-labels">
              <span className="tick-label">
                <span className="tick-icon">📦</span> v1 (Genesis)
              </span>
              <span className="tick-label">
                <span className="tick-icon">🏁</span> v{maxStep} (Latest)
              </span>
            </div>

            <div className="slider-wrapper">
              <input
                type="range"
                className="time-scrub-slider"
                min="1"
                max={maxStep}
                step="1"
                value={currentStep}
                onChange={handleSliderChange}
                aria-label="Shipment Version Scrubbing Slider"
                aria-valuemin="1"
                aria-valuemax={maxStep}
                aria-valuenow={currentStep}
                aria-valuetext={`Version ${currentStep}: ${activeMeta.label}`}
              />
              <div
                className="slider-progress-fill"
                style={{
                  width:
                    maxStep > 1 ? `${((currentStep - 1) / (maxStep - 1)) * 100}%` : '100%'
                }}
              />
            </div>

            {/* Discrete Version Tick Marks with Event Indicators & Hover Tooltips */}
            <div className="discrete-ticks" role="tablist" aria-label="Version Snapshots">
              {Array.from({ length: maxStep }, (_, idx) => {
                const stepNum = idx + 1;
                const isCurrent = stepNum === currentStep;
                const isPast = stepNum <= currentStep;
                const stepEvent = events && events[idx];
                const meta = getEventMeta(stepEvent);
                const isHovered = hoveredStep === stepNum;

                return (
                  <div
                    key={stepNum}
                    className={`tick-point-wrapper ${isCurrent ? 'tick-point-wrapper--active' : ''}`}
                    onMouseEnter={() => setHoveredStep(stepNum)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    {/* Rich Floating Tooltip */}
                    {isHovered && (
                      <div className="tick-tooltip" role="tooltip">
                        <div className="tooltip-top">
                          <span className="tooltip-icon">{meta.icon}</span>
                          <span className="tooltip-version">Version {stepNum}</span>
                        </div>
                        <span className="tooltip-title">{meta.label}</span>
                        <span className="tooltip-snippet">{meta.snippet}</span>
                        {stepEvent?.timestamp && (
                          <span className="tooltip-time">
                            {new Date(stepEvent.timestamp).toLocaleDateString()}{' '}
                            {new Date(stepEvent.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                        <span className="tooltip-arrow" />
                      </div>
                    )}

                    <button
                      type="button"
                      className={`tick-point ${isCurrent ? 'tick-point--active' : ''} ${isPast ? 'tick-point--filled' : ''} ${meta.typeClass}`}
                      onClick={() => {
                        setIsPlaying(false);
                        if (onStepChange) onStepChange(stepNum);
                      }}
                      title={`Jump to Version ${stepNum} (${meta.label})`}
                      aria-label={`Jump to Version ${stepNum}: ${meta.label}`}
                    >
                      <span className="tick-pip">
                        <span className="tick-pip-inner" />
                      </span>
                      <div className="tick-meta-col">
                        <span className="tick-icon-mini">{meta.icon}</span>
                        <span className="tick-number">v{stepNum}</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimeSlider;
