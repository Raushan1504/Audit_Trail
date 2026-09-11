import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getShipmentState, getShipmentEvents } from '../services/api';
import EventTimeline from '../components/EventTimeline';
import ShipmentState from '../components/ShipmentState';
import LoadingState from '../components/LoadingState';
import './ShipmentDetails.css';

function getErrorMessage(err) {
  if (!err) return 'Something went wrong.';
  if (err.status === 404) {
    return 'No shipment found with this ID. Double-check the ID and try again.';
  }
  if (err.status >= 500) {
    return 'The server ran into a problem. Please try again in a moment.';
  }
  if (err.message === 'Failed to fetch') {
    return 'Could not reach the server. Make sure the backend is running.';
  }
  return err.message || 'Something went wrong.';
}

// Client-side fold for interactive replay simulation
function foldEventsUpTo(events, step) {
  if (!Array.isArray(events) || events.length === 0) return null;
  const slice = step !== null ? events.slice(0, step) : events;

  const initialState = {
    shipmentId: null,
    status: 'UNKNOWN',
    location: null,
    temperature: null,
    vessel: null,
    cargo: null,
    version: 0
  };

  return slice.reduce((state, event) => {
    const next = { ...state, version: event.version };
    const type = event.eventType;

    if (type === 'CONTAINER_CREATED') {
      next.shipmentId = event.aggregateId;
      next.status = 'CREATED';
      next.location = event.payload?.origin || 'Origin Facility';
      next.cargo = event.payload?.cargo;
    } else if (type === 'LOADED_ON_SHIP') {
      next.status = 'LOADED';
      next.location = event.payload?.port || state.location;
      next.vessel = event.payload?.vessel || 'Vessel 01';
    } else if (type === 'TEMPERATURE_SPIKE') {
      next.status = 'ALERT';
      next.temperature = event.payload?.temperature;
    } else if (type === 'ARRIVED_AT_PORT') {
      next.status = 'ARRIVED';
      next.location = event.payload?.port || state.location;
    }
    return next;
  }, initialState);
}

function ShipmentDetails() {
  const { shipmentId } = useParams();
  const [shipmentData, setShipmentData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replayStep, setReplayStep] = useState(null); // null = full state

  useEffect(() => {
    if (!shipmentId) {
      setError({ message: 'No shipment ID provided.' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setReplayStep(null);

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

  // Determine what state data to show: folded replay or backend reconstructed
  const displayedState = replayStep !== null
    ? foldEventsUpTo(events, replayStep)
    : shipmentData;

  return (
    <div className="shipment-details-cinematic">
      {/* 3D Ambient Lighting */}
      <div className="details-ambient details-ambient--left" />
      <div className="details-ambient details-ambient--right" />

      {/* Top Navigation & Breadcrumbs */}
      <div className="details-nav">
        <Link to="/" className="details-nav__back">
          <span className="back-arrow">←</span>
          <span>Back to Console</span>
        </Link>
        <div className="details-nav__breadcrumb">
          <span>FORENSIC LEDGER</span>
          <span className="bc-sep">/</span>
          <span className="bc-id">{shipmentId}</span>
        </div>
      </div>

      {/* Cinematic Shipment Header */}
      <div className="details-header-card">
        <div className="details-header-card__glare" />
        <div className="details-header__main">
          <div className="details-header__title-group">
            <span className="details-header__label">AGGREGATE IDENTITY</span>
            <h1 className="details-header__id">{shipmentId}</h1>
          </div>
          <div className="details-header__audit-badge">
            <span className="audit-icon">🛡</span>
            <div>
              <span className="audit-title">CRYPTOGRAPHIC AUDIT CHAIN</span>
              <span className="audit-sub">SHA-256 Ledger Node · Tamper-Proof</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <LoadingState message={`Replaying Event Stream for ${shipmentId}...`} />
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="details-error-card">
          <span className="error-icon">⚠</span>
          <div className="error-content">
            <h3>Investigation Halted</h3>
            <p>{getErrorMessage(error)}</p>
          </div>
        </div>
      )}

      {/* Main Forensic Content */}
      {!loading && !error && displayedState && (
        <ShipmentState
          data={displayedState}
          eventCount={events.length}
          isReplaying={replayStep !== null}
          currentStep={replayStep}
        />
      )}

      {!loading && !error && (
        <div className="details-timeline-section">
          <div className="timeline-section-header">
            <div>
              <h2>Chronological Event Stream</h2>
              <p>Reconstruct current status by stepping through append-only domain events</p>
            </div>
          </div>
          <EventTimeline
            events={events}
            currentReplayStep={replayStep}
            onStepChange={setReplayStep}
          />
        </div>
      )}
    </div>
  );
}

export default ShipmentDetails;