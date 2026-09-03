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
      {events.map((event, index) => (
        <div className="event-timeline__item" key={event._id || index}>
          <div className="event-timeline__marker" />
          {index !== events.length - 1 && (
            <div className="event-timeline__line" />
          )}
          <div className="event-timeline__content">
            <div className="event-timeline__top-row">
              <span className="event-timeline__type">
                {formatEventType(event.eventType)}
              </span>
              <span className="event-timeline__version">
                v{event.version ?? '?'}
              </span>
            </div>

            <span className="event-timeline__timestamp">
              {event.timestamp
                ? new Date(event.timestamp).toLocaleString()
                : 'Unknown time'}
            </span>

            <span className="event-timeline__aggregate">
              Shipment: <code>{event.aggregateId || 'N/A'}</code>
            </span>

            {formatPayload(event.payload) && (
              <span className="event-timeline__payload">
                {formatPayload(event.payload)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default EventTimeline;