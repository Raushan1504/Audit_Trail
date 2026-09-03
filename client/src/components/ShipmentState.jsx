import './ShipmentState.css';

function ShipmentState({ data, eventCount = 0 }) {
  if (!data) return null;

  return (
    <div className="shipment-state">
      <div className="shipment-state__reconstructed-note">
        <span className="shipment-state__badge">Reconstructed</span>
        <span>
          This state was calculated by replaying {eventCount}{' '}
          {eventCount === 1 ? 'event' : 'events'} — it is not stored directly.
        </span>
      </div>

      <div className="shipment-state__grid">
        <div className="shipment-state__card">
          <span className="shipment-state__label">Current State</span>
          <span className="shipment-state__value">
            {data.status || data.state || 'Unknown'}
          </span>
        </div>

        <div className="shipment-state__card">
          <span className="shipment-state__label">Version</span>
          <span className="shipment-state__value">{data.version ?? 'N/A'}</span>
        </div>

        <div className="shipment-state__card">
          <span className="shipment-state__label">Location</span>
          <span className="shipment-state__value">{data.location || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}

export default ShipmentState;