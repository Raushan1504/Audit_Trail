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
import ConcurrencyConflictModal from './ConcurrencyConflictModal';
import './CommandPanel.css';

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

  const [formData, setFormData] = useState({
    vessel: 'MV PACIFIC VOYAGER',
    port: 'Shanghai Marine Terminal',
    temperature: '14.5',
    threshold: '4.0',
    sensorId: 'SENSOR-IOT-09',
    humidity: '68.5',
    batteryVoltage: '3.82',
    ambientTemp: '24.1'
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState(null);

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
      const isConflict = err.status === 409 || err.data?.code === 'CONCURRENCY_CONFLICT';
      if (isConflict) {
        const conflict = err.data?.conflict || {
          shipmentId,
          expectedVersion: loadedVersion,
          currentVersion: (err.data?.conflict?.currentVersion) ?? (loadedVersion + 1),
          resolutionHint: err.message || 'Optimistic concurrency violation detected. Reload state and retry.'
        };
        setConflictData(conflict);
        setConflictModalOpen(true);
      }
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

      {activeCommand && allowedCommands.includes(activeCommand) && (
        <form onSubmit={handleSubmit} className="command-form">
          <div className="form-fields-grid">

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

                <div className="form-field">
                  <label htmlFor="humidityInput">RELATIVE HUMIDITY (% RH)</label>

                  <input
                    id="humidityInput"
                    type="number"
                    step="0.1"
                    name="humidity"
                    value={formData.humidity || ''}
                    onChange={handleInputChange}
                    placeholder="e.g. 68.5"
                  />
                  <span className="field-help">Optional sensor humidity percentage.</span>

                </div>

                <div className="form-field">
                  <label htmlFor="voltageInput">BATTERY VOLTAGE (V)</label>

                  <input
                    id="voltageInput"
                    type="number"
                    step="0.01"
                    name="batteryVoltage"
                    value={formData.batteryVoltage || ''}
                    onChange={handleInputChange}
                    placeholder="e.g. 3.82"
                  />
                  <span className="field-help">IoT tracker battery reserve voltage.</span>

                </div>

                <div className="form-field">
                  <label htmlFor="ambientInput">AMBIENT TEMPERATURE (°C)</label>

                  <input
                    id="ambientInput"
                    type="number"
                    step="0.1"
                    name="ambientTemp"
                    value={formData.ambientTemp || ''}
                    onChange={handleInputChange}
                    placeholder="e.g. 24.1"
                  />
                  <span className="field-help">External container ambient temperature.</span>

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

          {feedback && (
            <div className={`command-feedback command-feedback--${feedback.type}`} role="alert">
              <span className="feedback-icon">{feedback.type === 'success' ? '✓' : '⚠'}</span>

              <div className="feedback-text">
                <strong>{feedback.type === 'success' ? 'Execution Succeeded:' : 'Execution Rejected:'}</strong> {feedback.message}

              </div>

            </div>

          )}

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

      <ConcurrencyConflictModal
        isOpen={conflictModalOpen}
        conflict={conflictData}
        onRefresh={() => {
          if (onJumpToLive) onJumpToLive();
          if (onCommandSuccess) onCommandSuccess();
          setConflictModalOpen(false);
          setFeedback(null);
        }}
        onClose={() => setConflictModalOpen(false)}
      />
    </div>

  );
}
