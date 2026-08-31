import { useParams, Link } from 'react-router-dom';
import './ShipmentDetails.css';

function ShipmentDetails() {
  const { shipmentId } = useParams();

  const placeholderData = {
    currentState: null,
    version: null,
    lastUpdated: null,
  };

  return (
    <div className="shipment-details">
      <Link to="/" className="shipment-details__back">
        ← Back to Search
      </Link>

      <div className="shipment-details__header">
        <h2>Shipment Details</h2>
        <span className="shipment-details__id">{shipmentId}</span>
      </div>

      <div className="shipment-details__grid">
        <div className="shipment-details__card">
          <span className="shipment-details__label">Current State</span>
          <span className="shipment-details__value shipment-details__value--placeholder">
            {placeholderData.currentState || 'Not yet available'}
          </span>
        </div>

        <div className="shipment-details__card">
          <span className="shipment-details__label">Version</span>
          <span className="shipment-details__value shipment-details__value--placeholder">
            {placeholderData.version ?? 'Not yet available'}
          </span>
        </div>

        <div className="shipment-details__card">
          <span className="shipment-details__label">Last Updated</span>
          <span className="shipment-details__value shipment-details__value--placeholder">
            {placeholderData.lastUpdated || 'Not yet available'}
          </span>
        </div>
      </div>

      <div className="shipment-details__timeline-placeholder">
        <p>Event timeline will appear here.</p>
      </div>
    </div>
  );
}

export default ShipmentDetails;