import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getShipmentState } from '../services/api';
import './ShipmentDetails.css';

function ShipmentDetails() {
  const { shipmentId } = useParams();
  const [shipmentData, setShipmentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    getShipmentState(shipmentId)
      .then((data) => {
        setShipmentData(data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [shipmentId]);

  return (
    <div className="shipment-details">
      <Link to="/" className="shipment-details__back">
        ← Back to Search
      </Link>

      <div className="shipment-details__header">
        <h2>Shipment Details</h2>
        <span className="shipment-details__id">{shipmentId}</span>
      </div>

      {loading && <p className="shipment-details__status">Loading shipment data...</p>}

      {error && (
        <p className="shipment-details__status shipment-details__status--error">
          Could not load shipment: {error}
        </p>
      )}

      {!loading && !error && shipmentData && (
        <div className="shipment-details__grid">
          <div className="shipment-details__card">
            <span className="shipment-details__label">Current State</span>
            <span className="shipment-details__value">
              {shipmentData.status || shipmentData.state || 'Unknown'}
            </span>
          </div>

          <div className="shipment-details__card">
            <span className="shipment-details__label">Version</span>
            <span className="shipment-details__value">
              {shipmentData.version ?? 'N/A'}
            </span>
          </div>

          <div className="shipment-details__card">
            <span className="shipment-details__label">Location</span>
            <span className="shipment-details__value">
              {shipmentData.location || 'N/A'}
            </span>
          </div>
        </div>
      )}

      <div className="shipment-details__timeline-placeholder">
        <p>Event timeline will appear here (Day 6-7).</p>
      </div>
    </div>
  );
}

export default ShipmentDetails;