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

function EventTimeline({ events = [] }) {
  if (!events || events.length === 0) {
    return (
      <div className="event-timeline event-timeline--empty">
        <p>No events to display yet.</p>
      </div>
    );
  }

  return (
    <div className="event-timeline">
      {/* Immutability Audit Banner */}
      <div className="event-timeline__immutability-banner">
        <div className="immutability-badge">
          <span className="immutability-icon">🔒</span>
          <span className="immutability-text">IMMUTABLE APPEND-ONLY LEDGER</span>
        </div>
        <div className="immutability-guarantees">
          <span className="guarantee-pill guarantee-pill--allowed">APPEND: ALLOWED</span>
          <span className="guarantee-pill guarantee-pill--blocked">UPDATE: BLOCKED</span>
          <span className="guarantee-pill guarantee-pill--blocked">DELETE: BLOCKED</span>
        </div>
      </div>

      <div className="event-timeline__stream">
        {events.map((event, index) => {
          const isTempSpike = event.eventType === 'TEMPERATURE_SPIKE';
          const isGenesis = event.version === 1 || event.eventType === 'CONTAINER_CREATED';
          const isTerminal = event.eventType === 'ARRIVED_AT_PORT';

          return (
            <div
              className={`event-timeline__item ${isTempSpike ? 'event-timeline__item--anomaly' : ''}`}
              key={event._id || index}
            >
              <div className="event-timeline__marker" />
              {index !== events.length - 1 && (
                <div className="event-timeline__line" />
              )}
              <div className="event-timeline__content">
                <div className="event-timeline__top-row">
                  <div className="event-timeline__heading">
                    <span className="event-timeline__type">
                      {formatEventType(event.eventType)}
                    </span>
                    {isGenesis && (
                      <span className="event-tag event-tag--genesis">Genesis Event</span>
                    )}
                    {isTempSpike && (
                      <span className="event-tag event-tag--anomaly">⚠ Thermal Anomaly</span>
                    )}
                    {isTerminal && (
                      <span className="event-tag event-tag--terminal">Terminal Port</span>
                    )}
                  </div>

                  <div className="event-timeline__badges">
                    <span className="event-timeline__immutable-badge" title="Cryptographically permanent and tamper-proof">
                      <span className="lock-icon">🔒</span> Immutable
                    </span>
                    <span className="event-timeline__version">
                      v{event.version ?? '?'}
                    </span>
                  </div>
                </div>

                <div className="event-timeline__meta-row">
                  <span className="event-timeline__timestamp">
                    {event.timestamp
                      ? new Date(event.timestamp).toLocaleString()
                      : 'Unknown time'}
                  </span>
                  <span className="event-timeline__block-num">
                    Ledger Block #{event.version ?? index + 1}
                  </span>
                </div>

                <span className="event-timeline__aggregate">
                  Shipment: <code>{event.aggregateId || 'N/A'}</code>
                </span>

                {formatPayload(event.payload) && (
                  <div className="event-timeline__payload">
                    <span className="payload-label">Payload:</span>
                    <span className="payload-data">{formatPayload(event.payload)}</span>
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