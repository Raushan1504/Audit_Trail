import { useState, useEffect } from 'react';
import './EventTimeline.css';

function formatEventType(eventType) {
  return eventType
    ? eventType.replace(/_/g, ' ')
    : 'UNKNOWN EVENT';
}

function formatPayload(payload) {
  if (!payload || Object.keys(payload).length === 0) return null;
  return Object.entries(payload)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
}

function EventTimeline({ events = [], onStepChange, currentReplayStep }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(null); // null means showing full latest state

  // Sync with prop if provided
  const effectiveStep = currentReplayStep !== undefined ? currentReplayStep : activeStep;

  // Auto-replay timer
  useEffect(() => {
    let timer;
    if (isPlaying && events.length > 0) {
      timer = setInterval(() => {
        setActiveStep((prev) => {
          const next = prev === null || prev >= events.length ? 1 : prev + 1;
          if (onStepChange) onStepChange(next);
          if (next >= events.length) {
            setIsPlaying(false);
          }
          return next;
        });
      }, 1200);
    }
    return () => clearInterval(timer);
  }, [isPlaying, events.length, onStepChange]);

  const handlePlayToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (effectiveStep === null || effectiveStep >= events.length) {
        setActiveStep(1);
        if (onStepChange) onStepChange(1);
      }
      setIsPlaying(true);
    }
  };

  const handleStepPrev = () => {
    setIsPlaying(false);
    const prev = (effectiveStep || events.length) - 1;
    const clamped = Math.max(1, prev);
    setActiveStep(clamped);
    if (onStepChange) onStepChange(clamped);
  };

  const handleStepNext = () => {
    setIsPlaying(false);
    const next = (effectiveStep || 0) + 1;
    const clamped = Math.min(events.length, next);
    setActiveStep(clamped);
    if (onStepChange) onStepChange(clamped);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setActiveStep(null);
    if (onStepChange) onStepChange(null);
  };

  if (!events || events.length === 0) {
    return (
      <div className="event-timeline-3d event-timeline-3d--empty">
        <span className="empty-icon">📂</span>
        <p>No historical events found for this shipment ledger.</p>
      </div>
    );
  }

  return (
    <div className="event-timeline-3d">
      {/* 3D Immutability & Replay Controller Banner */}
      <div className="event-timeline-3d__controls">
        <div className="timeline-info-badge">
          <span className="lock-icon">🔒</span>
          <div>
            <span className="timeline-info-title">IMMUTABLE EVENT STREAM</span>
            <span className="timeline-info-sub">{events.length} Historical Blocks · Tamper-Proof</span>
          </div>
        </div>

        {/* Interactive Event Replay Scrubber */}
        <div className="replay-controls">
          <span className="replay-label">EVENT REPLAY ENGINE:</span>
          <div className="replay-buttons">
            <button
              type="button"
              className="replay-btn"
              onClick={handleStepPrev}
              disabled={effectiveStep === 1}
              title="Step backwards in event history"
            >
              ⏮ Step
            </button>
            <button
              type="button"
              className={`replay-btn replay-btn--play ${isPlaying ? 'replay-btn--active' : ''}`}
              onClick={handlePlayToggle}
              title={isPlaying ? 'Pause replay simulation' : 'Start automated replay simulation'}
            >
              {isPlaying ? '⏸ Pause' : '▶ Replay Sequence'}
            </button>
            <button
              type="button"
              className="replay-btn"
              onClick={handleStepNext}
              disabled={effectiveStep === events.length || effectiveStep === null}
              title="Step forward in event history"
            >
              Step ⏭
            </button>
            <button
              type="button"
              className="replay-btn replay-btn--reset"
              onClick={handleReset}
              title="Reset to current final state"
            >
              ↺ Full State
            </button>
          </div>
          {effectiveStep !== null && (
            <span className="replay-status-pill">
              Replaying: Event {effectiveStep} / {events.length}
            </span>
          )}
        </div>
      </div>

      {/* Stream List */}
      <div className="event-timeline-3d__stream">
        {events.map((event, index) => {
          const stepNumber = index + 1;
          const isTempSpike = event.eventType === 'TEMPERATURE_SPIKE';
          const isGenesis = event.version === 1 || event.eventType === 'CONTAINER_CREATED';
          const isTerminal = event.eventType === 'ARRIVED_AT_PORT';
          const isCurrentReplayPoint = effectiveStep === stepNumber;
          const isPastReplayPoint = effectiveStep !== null && stepNumber <= effectiveStep;
          const isFutureReplayPoint = effectiveStep !== null && stepNumber > effectiveStep;

          return (
            <div
              className={`timeline-item-3d 
                ${isTempSpike ? 'timeline-item-3d--anomaly' : ''} 
                ${isCurrentReplayPoint ? 'timeline-item-3d--active-step' : ''}
                ${isFutureReplayPoint ? 'timeline-item-3d--future' : ''}
              `}
              key={event._id || index}
              onClick={() => {
                setActiveStep(stepNumber);
                if (onStepChange) onStepChange(stepNumber);
              }}
            >
              {/* 3D Connecting Line */}
              {index !== events.length - 1 && (
                <div className={`timeline-item-3d__line ${isPastReplayPoint ? 'timeline-item-3d__line--active' : ''}`} />
              )}

              {/* Glowing Marker */}
              <div className={`timeline-item-3d__marker ${isCurrentReplayPoint ? 'marker--pulsing' : ''}`}>
                <span className="marker-inner">{event.version ?? stepNumber}</span>
              </div>

              {/* 3D Glassmorphic Card */}
              <div className="timeline-item-3d__card">
                <div className="timeline-item-3d__glare" />

                <div className="timeline-card__top">
                  <div className="timeline-card__type-group">
                    <span className="timeline-card__type">
                      {formatEventType(event.eventType)}
                    </span>
                    {isGenesis && (
                      <span className="badge-pill badge-pill--genesis">Genesis Block</span>
                    )}
                    {isTempSpike && (
                      <span className="badge-pill badge-pill--anomaly">🔥 Thermal Spike Anomaly</span>
                    )}
                    {isTerminal && (
                      <span className="badge-pill badge-pill--terminal">🏁 Final Destination</span>
                    )}
                  </div>

                  <div className="timeline-card__tags">
                    <span className="immutable-tag" title="Immutable append-only ledger record">
                      <span>🔒</span> Immutable
                    </span>
                    <span className="version-pill">v{event.version ?? '?'}</span>
                  </div>
                </div>

                <div className="timeline-card__meta">
                  <span className="timestamp">
                    ⏱ {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Unknown'}
                  </span>
                  <span className="block-id">
                    Block Hash: <code>#{(event._id || event.version || '0').toString().slice(-8)}</code>
                  </span>
                </div>

                {formatPayload(event.payload) && (
                  <div className="timeline-card__payload">
                    <span className="payload-tag">PAYLOAD</span>
                    <span className="payload-content">{formatPayload(event.payload)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EventTimeline;