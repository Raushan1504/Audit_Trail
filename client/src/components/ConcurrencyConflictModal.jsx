import React from 'react';
import './ConcurrencyConflictModal.css';

/**
 * ConcurrencyConflictModal Component (Day 23)
 *
 * Displays an interactive optimistic concurrency conflict dialog when an HTTP 409
 * is received from Express, detailing the version collision and offering a one-click
 * "Refresh with Latest State" action to resynchronize the UI.
 */
export default function ConcurrencyConflictModal({
  isOpen,
  conflict,
  onRefresh,
  onClose
}) {
  if (!isOpen || !conflict) return null;

  const {
    shipmentId = 'UNKNOWN',
    expectedVersion = 0,
    currentVersion = 1,
    modifiedBy = 'Another operator or worker',
    resolutionHint = 'Reload the latest shipment state to see the recent changes and reapply your command.'
  } = conflict;

  const handleRefreshClick = () => {
    if (onRefresh) onRefresh();
    if (onClose) onClose();
  };

  return (
    <div className="occ-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="occ-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="occ-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="occ-modal-header">
          <div className="occ-header-icon-wrap">
            <span className="occ-header-icon">⚠️</span>
            <div>
              <h3 id="occ-modal-title" className="occ-modal-title">
                Optimistic Concurrency Conflict (HTTP 409)
              </h3>
              <p className="occ-modal-subtitle">
                State divergence prevented — your command was safely rejected
              </p>
            </div>
          </div>
          <button
            type="button"
            className="occ-modal-close-btn"
            onClick={onClose}
            aria-label="Close conflict modal"
          >
            ✕
          </button>
        </div>

        <div className="occ-modal-body">
          <div className="occ-alert-banner">
            <span className="occ-banner-icon">🔒</span>
            <div className="occ-banner-text">
              <strong>Aggregate Lock Conflict on <code>{shipmentId}</code></strong>
              <p>
                Another operator or background service mutated this shipment concurrently.
                To prevent accidental overwrites, commands cannot execute against stale version <code>v{expectedVersion}</code>.
              </p>
            </div>
          </div>

          <div className="occ-version-compare-grid">
            <div className="occ-version-card occ-version-card--stale">
              <span className="card-badge card-badge--stale">YOUR FORM STATE (STALE)</span>
              <div className="version-number">v{expectedVersion}</div>
              <span className="version-caption">Expected Version</span>
            </div>

            <div className="occ-version-arrow">➔</div>

            <div className="occ-version-card occ-version-card--current">
              <span className="card-badge card-badge--live">LIVE IN EVENT STORE</span>
              <div className="version-number">v{currentVersion}</div>
              <span className="version-caption">Latest Committed Version</span>
            </div>
          </div>

          <div className="occ-metadata-card">
            <div className="metadata-row">
              <span className="meta-label">Modified By:</span>
              <span className="meta-value">{modifiedBy}</span>
            </div>
            <div className="metadata-row">
              <span className="meta-label">Resolution Guidance:</span>
              <span className="meta-value resolution-text">{resolutionHint}</span>
            </div>
          </div>
        </div>

        <div className="occ-modal-footer">
          <button
            type="button"
            className="occ-btn occ-btn-secondary"
            onClick={onClose}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="occ-btn occ-btn-primary"
            onClick={handleRefreshClick}
          >
            <span>🔄</span>
            <span>Refresh with Latest State (v{currentVersion})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
