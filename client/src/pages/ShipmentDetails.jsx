import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getShipmentState, getShipmentEvents } from '../services/api';
import EventTimeline from '../components/EventTimeline';
import ShipmentState from '../components/ShipmentState';
import './ShipmentDetails.css';

function ShipmentDetails() {
  const { shipmentId } = useParams();
  const [shipmentData, setShipmentData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!shipmentId) {
      setError('No shipment ID provided.');
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
        {shipmentId && <span className="shipment-details__id">{shipmentId}</span>}
      </div>

      {loading && <p className="shipment-details__status">Loading shipment data...</p>}

      {error && (
        <p className="shipment-details__status shipment-details__status--error">
          Could not load shipment: {error}
        </p>
      )}

      {!loading && !error && shipmentData && (
        <ShipmentState data={shipmentData} />
      )}

      <div className="shipment-details__timeline-section">
        <h3>Event History</h3>
        {!loading && !error && <EventTimeline events={events} />}
      </div>
    </div>
  );
}

export default ShipmentDetails;