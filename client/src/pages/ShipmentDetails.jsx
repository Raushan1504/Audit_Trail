import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getShipmentState, getShipmentEvents } from '../services/api';
import EventTimeline from '../components/EventTimeline';
import ShipmentState from '../components/ShipmentState';
import './ShipmentDetails.css';

function getErrorMessage(err) {
  if (!err) return 'Something went wrong.';
  if (err.status === 404) {
    return `No shipment found with this ID. Double-check the ID and try again.`;
  }
  if (err.status >= 500) {
    return 'The server ran into a problem. Please try again in a moment.';
  }
  if (err.message === 'Failed to fetch') {
    return 'Could not reach the server. Make sure the backend is running.';
  }
  return err.message || 'Something went wrong.';
}

function ShipmentDetails() {
  const { shipmentId } = useParams();
  const [shipmentData, setShipmentData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!shipmentId) {
      setError({ message: 'No shipment ID provided.' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      getShipmentState(shipmentId),
      getShipmentEvents(shipmentId),
    ])
      .then(([stateData, eventsData]) => {
        setShipmentData(stateData);
        setEvents(Array.isArray(eventsData) ? eventsData : []);
      })
      .catch((err) => {
        setError(err);
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
        {shipmentId && <span className="shipment-details__id">{shipmentId}</span>}
      </div>

      {loading && (
        <div className="shipment-details__loading">
          <div className="shipment-details__spinner" />
          <span>Loading shipment data...</span>
        </div>
      )}

      {!loading && error && (
        <div className="shipment-details__error">
          <span className="shipment-details__error-icon">⚠</span>
          <span>{getErrorMessage(error)}</span>
        </div>
      )}

      {!loading && !error && shipmentData && (
        <ShipmentState data={shipmentData} eventCount={events.length} />
      )}

      {!loading && !error && (
        <div className="shipment-details__timeline-section">
          <h3>Event History</h3>
          <EventTimeline events={events} />
        </div>
      )}
    </div>
  );
}

export default ShipmentDetails;