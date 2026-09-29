import React, { useState, useEffect } from 'react';
import {
  OCC_COMMAND_TYPES,
  getAllowedCommandsForStatus,
  buildOccCommandPayload
} from '../utils/concurrency';
import {
  loadShipmentCommand,
  recordTemperatureSpikeCommand,
  arriveAtPortCommand
} from '../services/api';
import './CommandPanel.css';

/**
 * CommandPanel Component (Day 22)
 *
 * Implements Optimistic Concurrency Control (OCC) command dispatch.
 * Captures the current loaded aggregate version during query fetch and
 * binds it into React form state as expectedVersion, forwarding it inside
 * command payloads to protect against race conditions and state divergence.
 */
export default function CommandPanel({
  shipmentId,
  currentStatus = 'UNKNOWN',
  loadedVersion = 0,
  isHistoricalActive = false,
  onJumpToLive,
  onCommandSuccess
}) {
  const allowedCommands = getAllowedCommandsForStatus(currentStatus);
  const [activeCommand, setActiveCommand] = useState(allowedCommands[0] || null);
  const [showPayloadPreview, setShowPayloadPreview] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    vessel: 'MV PACIFIC VOYAGER',
    port: 'Shanghai Marine Terminal',
    temperature: '14.5',
    threshold: '4.0',
    sensorId: 'SENSOR-IOT-09'
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string, data?: any }

  // Synchronize activeCommand when status changes
  useEffect(() => {
    if (allowedCommands.length > 0 && (!activeCommand || !allowedCommands.includes(activeCommand))) {
      setActiveCommand(allowedCommands[0]);
    }
  }, [currentStatus]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFeedback(null);
  };

  // Construct current OCC command payload
  let currentPayload = null;
  let payloadError = null;
  if (activeCommand && shipmentId) {
    try {
      currentPayload = buildOccCommandPayload(activeCommand, shipmentId, formData, loadedVersion);
    } catch (err) {
      payloadError = err.message;
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeCommand || !shipmentId || isHistoricalActive) return;

    if (allowedCommands.length > 0 && !allowedCommands.includes(activeCommand)) {
      setFeedback({
        type: 'error',
        message: `Invalid command: Cannot execute '${activeCommand}' when shipment is already in '${currentStatus}' status.`
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const payload = buildOccCommandPayload(activeCommand, shipmentId, formData, loadedVersion);
      let result;

      if (activeCommand === OCC_COMMAND_TYPES.LOAD_ON_SHIP) {
        result = await loadShipmentCommand(shipmentId, payload);
      } else if (activeCommand === OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE) {
        result = await recordTemperatureSpikeCommand(shipmentId, payload);
      } else if (activeCommand === OCC_COMMAND_TYPES.ARRIVE_AT_PORT) {
        result = await arriveAtPortCommand(shipmentId, payload);
      }

      setFeedback({
        type: 'success',
        message: `Command executed! Appended event at version ${result?.version || loadedVersion + 1} with OCC lock v${loadedVersion}.`,
        data: result
      });

      if (onCommandSuccess) {
        onCommandSuccess();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Command dispatch failed due to an unexpected error.',
        status: err.status
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="command-panel-card">
      <div className="command-panel-glow" />

      {/* Header with OCC Concurrency Lock Status */}
      <div className="command-panel-header">
        <div className="header-badge-row">
          <div className="occ-guard-badge">
            <span className="occ-lock-icon">🔒</span>
            <span className="occ-title">OPTIMISTIC CONCURRENCY CONTROL</span>
            <span className="occ-status-tag">ACTIVE GUARD</span>
          </div>

          <div className="version-lock-indicator">
            <span className="lock-label">TRACKED AGGREGATE VERSION:</span>
            <span className="lock-value">v{loadedVersion}</span>
          </div>
        </div>

        <h3 className="command-panel-title">Dispatch Logistics Domain Command</h3>
        <p className="command-panel-subtitle">
          All state transitions require an exact <code>expectedVersion: {loadedVersion}</code> match.
          If another operator mutates this aggregate concurrently, your command is protected and rejected with HTTP 409 Conflict.
        </p>
      </div>

      {/* Historical Mode Warning Callout */}
      {isHistoricalActive && (
        <div className="command-historical-warning" role="alert">
          <div className="warning-left">
            <span className="warning-icon">⚠</span>
            <div>
              <strong>COMMANDS FROZEN IN HISTORICAL VIEW:</strong> You are currently inspecting a scrubbed past state.
              Commands can only be dispatched against the live confirmed head (v{loadedVersion}).
            </div>
          </div>
          {onJumpToLive && (
            <button
              type="button"
              className="btn-jump-live-occ"
              onClick={onJumpToLive}
            >
              ⚡ Return to Live Head to Dispatch
            </button>
          )}
        </div>
      )}

      {/* Command Action Tabs */}
      <div className="command-tabs-container">
        <span className="tabs-label">AVAILABLE COMMANDS FOR STATUS ({currentStatus}):</span>
        <div className="command-tabs-list" role="tablist">
          {allowedCommands.length === 0 ? (
            <div className="no-commands-message">
              <span>🏁</span>
              <span>Voyage Terminated at Port — Terminal state reached. No further state transitions allowed.</span>
            </div>
          ) : (
            allowedCommands.map((type) => {
              const isActive = activeCommand === type;
              let label = type;
              let icon = '⚡';

              if (type === OCC_COMMAND_TYPES.LOAD_ON_SHIP) {
                label = 'Load on Vessel';
                icon = '⚓';
              } else if (type === OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE) {
                label = 'Report Thermal Anomaly';
                icon = '🔥';
              } else if (type === OCC_COMMAND_TYPES.ARRIVE_AT_PORT) {
                label = 'Confirm Port Arrival';
                icon = '🏁';
              }

              return (
                <button
                  key={type}
                  type="button"
                  className={`command-tab-btn ${isActive ? 'command-tab-btn--active' : ''}`}
                  onClick={() => {
                    setActiveCommand(type);
                    setFeedback(null);
                  }}
                  role="tab"
                  aria-selected={isActive}
                >
                  <span className="tab-icon">{icon}</span>
                  <span className="tab-label">{label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Command Form */}
      {activeCommand && allowedCommands.includes(activeCommand) && (
        <form onSubmit={handleSubmit} className="command-form">
          <div className="form-fields-grid">
            {/* Read-Only Tracked OCC Expected Version Field */}
            <div className="form-field form-field--locked">
              <label htmlFor="occExpectedVersion">
                <span className="field-label-text">EXPECTED AGGREGATE VERSION (OCC)</span>
                <span className="field-lock-tag">🔒 LOCKED</span>
              </label>
              <div className="locked-input-wrapper">
                <input
                  id="occExpectedVersion"
                  type="text"
                  value={`Version ${loadedVersion} (expectedVersion: ${loadedVersion})`}
                  readOnly
                  disabled
                  className="locked-version-input"
                />
              </div>
              <span className="field-help">Captured from query fetch; forwarded to prevent race conditions.</span>
            </div>

            {/* Dynamic Inputs Based on Active Command */}
            {activeCommand === OCC_COMMAND_TYPES.LOAD_ON_SHIP && (
              <>
                <div className="form-field">
                  <label htmlFor="vesselInput">VESSEL NAME</label>
                  <input
                    id="vesselInput"
                    type="text"
                    name="vessel"
                    value={formData.vessel}
                    onChange={handleInputChange}
                    placeholder="e.g. MV PACIFIC VOYAGER"
                    required
                  />
                  <span className="field-help">Name of ocean freight vessel.</span>
                </div>

                <div className="form-field">
                  <label htmlFor="portInput">DEPARTURE / LOADING PORT</label>
                  <input
                    id="portInput"
                    type="text"
                    name="port"
                    value={formData.port}
                    onChange={handleInputChange}
                    placeholder="e.g. Port of Shanghai"
                    required
                  />
                  <span className="field-help">Loading terminal location.</span>
                </div>
              </>
            )}

            {activeCommand === OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE && (
              <>
                <div className="form-field">
                  <label htmlFor="tempInput">RECORDED TEMPERATURE (°C)</label>
                  <input
                    id="tempInput"
                    type="number"
                    step="0.1"
                    name="temperature"
                    value={formData.temperature}
                    onChange={handleInputChange}
                    placeholder="e.g. 14.5"
                    required
                  />
                  <span className="field-help">Sensor reading in degrees Celsius.</span>
                </div>

                <div className="form-field">
                  <label htmlFor="thresholdInput">CRITICAL THRESHOLD (°C)</label>
                  <input
                    id="thresholdInput"
                    type="number"
                    step="0.1"
                    name="threshold"
                    value={formData.threshold}
                    onChange={handleInputChange}
                    placeholder="e.g. 4.0"
                    required
                  />
                  <span className="field-help">Acceptable maximum temperature.</span>
                </div>

                <div className="form-field">
                  <label htmlFor="sensorInput">SENSOR IDENTIFIER</label>
                  <input
                    id="sensorInput"
                    type="text"
                    name="sensorId"
                    value={formData.sensorId}
                    onChange={handleInputChange}
                    placeholder="e.g. SENSOR-IOT-09"
                    required
                  />
                  <span className="field-help">Hardware telemetry probe ID.</span>
                </div>
              </>
            )}

            {activeCommand === OCC_COMMAND_TYPES.ARRIVE_AT_PORT && (
              <div className="form-field">
                <label htmlFor="arrivePortInput">DESTINATION TERMINAL PORT</label>
                <input
                  id="arrivePortInput"
                  type="text"
                  name="port"
                  value={formData.port}
                  onChange={handleInputChange}
                  placeholder="e.g. Port of Rotterdam Terminal 4"
                  required
                />
                <span className="field-help">Final arrival terminal hub.</span>
              </div>
            )}
          </div>

          {/* OCC Payload Preview Toggle */}
          <div className="payload-preview-section">
            <button
              type="button"
              className="toggle-preview-btn"
              onClick={() => setShowPayloadPreview(!showPayloadPreview)}
            >
              <span>{showPayloadPreview ? '▼ Hide' : '▶ Show'} Outgoing OCC Payload JSON</span>
              <span className="preview-badge">expectedVersion: {loadedVersion}</span>
            </button>

            {showPayloadPreview && currentPayload && (
              <pre className="payload-json-box">
                <code>{JSON.stringify(currentPayload, null, 2)}</code>
              </pre>
            )}
          </div>

          {/* Feedback Messages */}
          {feedback && (
            <div className={`command-feedback command-feedback--${feedback.type}`} role="alert">
              <span className="feedback-icon">{feedback.type === 'success' ? '✓' : '⚠'}</span>
              <div className="feedback-text">
                <strong>{feedback.type === 'success' ? 'Execution Succeeded:' : 'Execution Rejected:'}</strong> {feedback.message}
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="form-actions-row">
            <button
              type="submit"
              disabled={submitting || isHistoricalActive || !!payloadError}
              className="btn-dispatch-command"
            >
              <span className="btn-icon">⚡</span>
              <span>
                {submitting
                  ? 'Dispatching Command...'
                  : `Dispatch ${activeCommand} with OCC Lock (v${loadedVersion})`}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
