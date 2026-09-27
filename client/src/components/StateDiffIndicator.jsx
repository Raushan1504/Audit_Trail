import React from 'react';
import './StateDiffIndicator.css';

/**
 * Visual Historical State Diff Indicator (Day 18)
 *
 * Compares the currently scrubbed historical state against the confirmed live head state.
 * Displays field-level diff badges (MODIFIED / UNCHANGED), directional transitions,
 * lag indicators, and quick temporal transport actions.
 */
export default function StateDiffIndicator({
  historicalState,
  liveState,
  currentVersion = 1,
  totalVersions = 1,
  activeEvent = null,
  onFastForward,
  onRewind,
  onStepChange,
  isPlaying = false,
  onPlayToggle
}) {
  if (!historicalState || !liveState) return null;

  const isAtHead = currentVersion >= totalVersions;
  const versionsBehind = Math.max(0, totalVersions - currentVersion);

  // Field comparison definitions
  const diffFields = [
    {
      id: 'status',
      label: 'OPERATIONAL STATUS',
      icon: '⚡',
      pastVal: historicalState.status || 'UNKNOWN',
      liveVal: liveState.status || 'UNKNOWN',
      isDiff: (historicalState.status || '') !== (liveState.status || '')
    },
    {
      id: 'location',
      label: 'LOCATION / HUB',
      icon: '📍',
      pastVal: historicalState.location || 'Origin Facility',
      liveVal: liveState.location || 'Destination Port',
      isDiff: (historicalState.location || '') !== (liveState.location || '')
    },
    {
      id: 'temperature',
      label: 'SENSOR TELEMETRY',
      icon: '🌡',
      pastVal: historicalState.temperature != null ? `${historicalState.temperature}°C` : 'Nominal / Unset',
      liveVal: liveState.temperature != null ? `${liveState.temperature}°C` : 'Nominal / Unset',
      isDiff: historicalState.temperature !== liveState.temperature
    },
    {
      id: 'vessel',
      label: 'ASSIGNED VESSEL',
      icon: '🚢',
      pastVal: historicalState.vessel || 'Pending Allocation',
      liveVal: liveState.vessel || 'Pending Allocation',
      isDiff: (historicalState.vessel || '') !== (liveState.vessel || '')
    }
  ];

  const totalDiffs = diffFields.filter(f => f.isDiff).length;

  return (
    <div className={`state-diff-container ${isAtHead ? 'state-diff-container--synced' : 'state-diff-container--diverged'}`}>
      <div className="state-diff-glass-card">
        {/* Top Header Banner */}
        <div className="state-diff-header">
          <div className="state-diff-header__main">
            <div className="diff-badge-indicator">
              <span className={`diff-radar-dot ${isAtHead ? 'diff-radar-dot--green' : 'diff-radar-dot--amber'}`} />
              <span className="diff-version-tag">
                Viewing state at Version {currentVersion} of {totalVersions}
              </span>
            </div>

            <div className="diff-headline">
              <h3>Historical State Diff Comparison</h3>
              <p>Evaluating divergence between scrubbed temporal snapshot and live confirmed ledger</p>
            </div>
          </div>

          <div className="state-diff-header__metrics">
            {isAtHead ? (
              <div className="diff-metric diff-metric--synced">
                <span className="metric-icon">✓</span>
                <div>
                  <span className="metric-val">SYNCED AT HEAD</span>
                  <span className="metric-sub">0 changes pending</span>
                </div>
              </div>
            ) : (
              <div className="diff-metric diff-metric--lag">
                <span className="metric-icon">⏳</span>
                <div>
                  <span className="metric-val">{versionsBehind} {versionsBehind === 1 ? 'VERSION' : 'VERSIONS'} BEHIND</span>
                  <span className="metric-sub">{totalDiffs} field {totalDiffs === 1 ? 'mutation' : 'mutations'} identified</span>
                </div>
              </div>
            )}

            <div className="diff-transport-actions">
              {onPlayToggle && (
                <button
                  type="button"
                  className={`diff-btn diff-btn--play ${isPlaying ? 'diff-btn--playing' : ''}`}
                  onClick={onPlayToggle}
                  title="Toggle automated playback simulation"
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
              )}
              {!isAtHead && onFastForward && (
                <button
                  type="button"
                  className="diff-btn diff-btn--fastforward"
                  onClick={onFastForward}
                  title="Fast-forward state to live head"
                >
                  ⚡ Fast-Forward to Live
                </button>
              )}
              {currentVersion > 1 && onRewind && (
                <button
                  type="button"
                  className="diff-btn diff-btn--rewind"
                  onClick={onRewind}
                  title="Rewind state to Genesis container creation"
                >
                  ⏮ Genesis (v1)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Event Context Bar */}
        {activeEvent && (
          <div className="diff-event-context">
            <span className="context-label">POINT-IN-TIME EVENT:</span>
            <span className="context-type">{activeEvent.eventType}</span>
            <span className="context-version">Sequence #{activeEvent.version}</span>
            {activeEvent.timestamp && (
              <span className="context-timestamp">
                ⏱ {new Date(activeEvent.timestamp).toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Matrix of Field-by-Field Differences */}
        <div className="state-diff-matrix">
          {diffFields.map((field) => (
            <div
              key={field.id}
              className={`diff-card ${field.isDiff ? 'diff-card--modified' : 'diff-card--identical'}`}
            >
              <div className="diff-card__header">
                <div className="diff-card__title">
                  <span className="field-icon">{field.icon}</span>
                  <span className="field-name">{field.label}</span>
                </div>
                <span className={`diff-pill ${field.isDiff ? 'diff-pill--modified' : 'diff-pill--identical'}`}>
                  {field.isDiff ? 'MODIFIED' : 'UNCHANGED'}
                </span>
              </div>

              <div className="diff-card__comparison">
                {/* Past Value */}
                <div className="diff-value-box diff-value-box--past">
                  <span className="box-label">v{currentVersion} Scrubbed State</span>
                  <span className="box-value">{field.pastVal}</span>
                </div>

                {/* Transition Flow Arrow */}
                <div className="diff-arrow-container">
                  <span className={`diff-arrow ${field.isDiff ? 'diff-arrow--active' : ''}`}>➔</span>
                </div>

                {/* Live Head Value */}
                <div className="diff-value-box diff-value-box--live">
                  <span className="box-label">v{totalVersions} Live Head</span>
                  <span className="box-value">{field.liveVal}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Step-by-Step Mini Navigator Footer */}
        {onStepChange && totalVersions > 1 && (
          <div className="diff-nav-footer">
            <div className="diff-progress-bar-wrapper">
              <div
                className="diff-progress-bar-fill"
                style={{ width: `${Math.round((currentVersion / totalVersions) * 100)}%` }}
              />
            </div>
            <div className="diff-nav-controls">
              <button
                type="button"
                className="diff-nav-btn"
                disabled={currentVersion <= 1}
                onClick={() => onStepChange(currentVersion - 1)}
              >
                ◀ Previous (v{Math.max(1, currentVersion - 1)})
              </button>
              {onPlayToggle && (
                <button
                  type="button"
                  className={`diff-nav-btn diff-nav-btn--play ${isPlaying ? 'diff-nav-btn--playing' : ''}`}
                  onClick={onPlayToggle}
                  title={isPlaying ? 'Pause automated playback' : 'Play automated playback'}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
              )}
              <span className="diff-nav-counter">
                Version {currentVersion} of {totalVersions} ({Math.round((currentVersion / totalVersions) * 100)}% Journey)
              </span>
              <button
                type="button"
                className="diff-nav-btn"
                disabled={currentVersion >= totalVersions}
                onClick={() => onStepChange(currentVersion + 1)}
              >
                Next (v{Math.min(totalVersions, currentVersion + 1)}) ▶
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
