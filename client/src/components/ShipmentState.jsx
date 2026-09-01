import './ShipmentState.css';

function ShipmentState({ data }) {
  if (!data) return null;

  return (
    <div className="shipment-state">
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
  );
}

export default ShipmentState;