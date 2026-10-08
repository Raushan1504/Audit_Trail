import React from 'react';
import { getHistoricalAlertMeta } from '../utils/historicalAlerts';
import './HistoricalWarningBanner.css';

export default function HistoricalWarningBanner({
  currentVersion = 1,
  totalVersions = 1,
  activeEvent = null,
  onReturnToLive,
  isPlaying = false,
  onPlayToggle
}) {
  const alertMeta = getHistoricalAlertMeta(currentVersion, totalVersions, activeEvent);
  const { current, total, versionsBehind, isAtHead, severity } = alertMeta;

  return (
    <div
      className={`historical-warning-banner historical-warning-banner--${severity}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >

      <div className="historical-warning-banner__stripes" />

      <div className="historical-warning-banner__inner">

        <div className="historical-warning-banner__icon-col">
          <div className="hazard-beacon">
            <span className="hazard-beacon__glow" />
            <span className="hazard-icon" aria-hidden="true">⚠</span>

          </div>

          <span className="hazard-sub-tag">NOT LIVE</span>

        </div>

        <div className="historical-warning-banner__content">
          <div className="historical-warning-banner__headline-row">
            <h2 className="historical-warning-banner__title">
              HISTORICAL INSPECTION ACTIVE — NOT LIVE OPERATIONAL DATA
            </h2>

            <span className={`version-lag-pill ${isAtHead ? 'version-lag-pill--head' : 'version-lag-pill--lag'}`}>
              {isAtHead ? (
                '✓ AT LEDGER HEAD'
              ) : (
                `⏳ ${versionsBehind} ${versionsBehind === 1 ? 'VERSION' : 'VERSIONS'} BEHIND LIVE HEAD`
              )}
            </span>

          </div>

          <p className="historical-warning-banner__description">
            Viewing point-in-time state at <strong>Version {current} of {total}</strong>.

            All cargo telemetry, environmental temperatures, vessel positions, and milestone statuses reflect
            <strong> past recorded states</strong>.

          </p>

          <div className="historical-warning-banner__alert-notice">
            <span className="notice-icon">🛡</span>

            <span className="notice-text">
              <strong>OPERATOR NOTICE:</strong> Do not dispatch response teams or make operational decisions

              based on this snapshot. Live confirmed ledger head remains accessible via the button below or pressing <kbd>Esc</kbd>.

            </span>

          </div>

          {activeEvent && (
            <div className="historical-warning-banner__event-bar">
              <span className="event-bar__label">HISTORICAL EVENT:</span>

              <span className="event-bar__badge">{activeEvent.eventType}</span>

              <span className="event-bar__seq">Seq #{activeEvent.version}</span>

              {activeEvent.timestamp && (
                <span className="event-bar__time">
                  ⏱ {new Date(activeEvent.timestamp).toLocaleDateString()} {new Date(activeEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>

              )}
            </div>

          )}
        </div>

        <div className="historical-warning-banner__actions">
          {onReturnToLive && (
            <button
              type="button"
              className="btn-return-live-head"
              onClick={onReturnToLive}
              title="Return immediately to confirmed live head state [Esc]"
            >
              <span className="btn-icon">⚡</span>

              <span className="btn-label">Return to Live Head</span>

              <kbd className="btn-kbd">Esc</kbd>

            </button>

          )}

          {onPlayToggle && (
            <button
              type="button"
              className={`btn-banner-play ${isPlaying ? 'btn-banner-play--active' : ''}`}
              onClick={onPlayToggle}
              title={isPlaying ? 'Pause automated playback [Space]' : 'Play step-by-step playback [Space]'}
            >
              <span>{isPlaying ? '⏸ Pause' : '▶ Play Voyage'}</span>

            </button>

          )}
        </div>

      </div>

    </div>

  );
}
