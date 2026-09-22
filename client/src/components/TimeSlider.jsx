import { useState } from 'react';
import { getEventMeta, formatEventName } from '../utils/eventMeta';
import './TimeSlider.css';

function TimeSlider({
  viewMode = 'live',
  onViewModeChange,
  totalEvents = 0,
  currentStep = 1,
  onStepChange,
  events = []
}) {
  const [hoveredStep, setHoveredStep] = useState(null);

  const isLive = viewMode === 'live';
  const isHistorical = viewMode === 'historical';
  const maxStep = Math.max(1, totalEvents);
  const activeEvent = events && events.length > 0 && currentStep >= 1 && currentStep <= events.length
    ? events[currentStep - 1]
    : null;
  const activeMeta = getEventMeta(activeEvent);
  const stepsBehind = maxStep - currentStep;

  const handleModeToggle = (targetMode) => {
    if (onViewModeChange) {
      onViewModeChange(targetMode);
    }
  };

  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (onStepChange && !isNaN(val)) {
      onStepChange(val);
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

  const handleJumpGenesis = () => {
    if (onStepChange) {
      onStepChange(1);
    }
  };

  const handleJumpLatest = () => {
    if (onStepChange) {
      onStepChange(maxStep);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      handleStepPrev();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      handleStepNext();
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleJumpGenesis();
    } else if (e.key === 'End') {
      e.preventDefault();
      handleJumpLatest();
    }
  };

  if (totalEvents === 0) {
    return null;
  }

  return (
    <div className={`time-travel-bar ${isHistorical ? 'time-travel-bar--historical' : 'time-travel-bar--live'}`}>
      <div className="time-travel-bar__glow" />

      {/* Top Controls: Mode Switcher & Status Badges */}
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
              <span className="badge-meta">Inspecting Version {currentStep} of {maxStep}</span>
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

      {/* Day 16: Interactive State Scrubber Slider Drawer */}
      {isHistorical && (
        <div className="time-travel-bar__scrubber">
          <div className="scrubber-transport">
            {/* Quick Transport Buttons */}
            <div className="transport-nav-buttons">
              <button
                type="button"
                className="transport-btn"
                onClick={handleJumpGenesis}
                disabled={currentStep <= 1}
                title="Rewind to Genesis (Version 1)"
              >
                ⏮ Genesis
              </button>
              <button
                type="button"
                className="transport-btn"
                onClick={handleStepPrev}
                disabled={currentStep <= 1}
                title="Step backward one event"
              >
                ◀ Prev
              </button>
              <button
                type="button"
                className="transport-btn"
                onClick={handleStepNext}
                disabled={currentStep >= maxStep}
                title="Step forward one event"
              >
                Next ▶
              </button>
              <button
                type="button"
                className="transport-btn"
                onClick={handleJumpLatest}
                disabled={currentStep >= maxStep}
                title="Fast-forward to latest state"
              >
                Latest ⏭
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
                    {new Date(activeEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

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
                onKeyDown={handleKeyDown}
                aria-label="Shipment Version Scrubbing Slider"
                aria-valuemin="1"
                aria-valuemax={maxStep}
                aria-valuenow={currentStep}
                aria-valuetext={`Version ${currentStep}: ${activeMeta.label}`}
              />
              <div
                className="slider-progress-fill"
                style={{
                  width: maxStep > 1 ? `${((currentStep - 1) / (maxStep - 1)) * 100}%` : '100%'
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
                            {new Date(stepEvent.timestamp).toLocaleDateString()} {new Date(stepEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <span className="tooltip-arrow" />
                      </div>
                    )}

                    <button
                      type="button"
                      className={`tick-point ${isCurrent ? 'tick-point--active' : ''} ${isPast ? 'tick-point--filled' : ''} ${meta.typeClass}`}
                      onClick={() => onStepChange && onStepChange(stepNum)}
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
