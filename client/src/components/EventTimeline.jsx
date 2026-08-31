import './EventTimeline.css';

function EventTimeline({ events = [] }) {
  if (events.length === 0) {
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
            <span className="event-timeline__type">{event.eventType}</span>
            <span className="event-timeline__timestamp">
              {event.timestamp
                ? new Date(event.timestamp).toLocaleString()
                : 'Unknown time'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default EventTimeline;