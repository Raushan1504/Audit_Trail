import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getShipmentState, getShipmentEvents } from '../services/api';
import EventTimeline from '../components/EventTimeline';
import ShipmentState from '../components/ShipmentState';
import LoadingState from '../components/LoadingState';
import TimeSlider from '../components/TimeSlider';
import StateDiffIndicator from '../components/StateDiffIndicator';
import ShipmentMap from '../components/ShipmentMap';
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

const DEMO_FALLBACKS = {
  'SHIP-001': [
    { aggregateId: 'SHIP-001', eventType: 'CONTAINER_CREATED', version: 1, payload: { origin: 'Port of Shanghai', cargo: 'Solar Photovoltaic Modules', destination: 'Port of Rotterdam' }, timestamp: new Date(Date.now() - 4 * 86400000) },
    { aggregateId: 'SHIP-001', eventType: 'LOADED_ON_SHIP', version: 2, payload: { port: 'Shanghai Marine Terminal', vessel: 'MV PACIFIC VOYAGER' }, timestamp: new Date(Date.now() - 3 * 86400000) },
    { aggregateId: 'SHIP-001', eventType: 'TEMPERATURE_SPIKE', version: 3, payload: { temperature: 13.5, threshold: 4.0 }, timestamp: new Date(Date.now() - 2 * 86400000) },
    { aggregateId: 'SHIP-001', eventType: 'ARRIVED_AT_PORT', version: 4, payload: { port: 'Port of Rotterdam Terminal 4' }, timestamp: new Date(Date.now() - 1 * 86400000) }
  ],
  'SHIP-TEMP-ALERT': [
    { aggregateId: 'SHIP-TEMP-ALERT', eventType: 'CONTAINER_CREATED', version: 1, payload: { origin: 'Port of Antwerp', cargo: 'Temperature-Sensitive Vaccines', destination: 'Port of Singapore' }, timestamp: new Date(Date.now() - 3 * 86400000) },
    { aggregateId: 'SHIP-TEMP-ALERT', eventType: 'LOADED_ON_SHIP', version: 2, payload: { port: 'Antwerp Gateway', vessel: 'MV NORDIC ARCTIC' }, timestamp: new Date(Date.now() - 2 * 86400000) },
    { aggregateId: 'SHIP-TEMP-ALERT', eventType: 'TEMPERATURE_SPIKE', version: 3, payload: { temperature: 15.2, threshold: 2.0 }, timestamp: new Date(Date.now() - 1 * 86400000) }
  ],
  'CONT-GENESIS-99': [
    { aggregateId: 'CONT-GENESIS-99', eventType: 'CONTAINER_CREATED', version: 1, payload: { origin: 'Hamburg Logistics Facility', cargo: 'Precision Robotic Components', destination: 'Port of Busan' }, timestamp: new Date() }
  ]
};

function ShipmentDetails() {
  const { shipmentId } = useParams();
  const [shipmentData, setShipmentData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('live'); // 'live' | 'historical'
  const [replayStep, setReplayStep] = useState(null); // null = full state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(false);

  useEffect(() => {
    if (!shipmentId) {
      setError({ message: 'No shipment ID provided.' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setReplayStep(null);
    setViewMode('live');
    setIsPlaying(false);

    const normId = shipmentId.trim().toUpperCase();

    Promise.all([
      getShipmentState(normId),
      getShipmentEvents(normId),
    ])
      .then(([stateData, eventsData]) => {
        setShipmentData(stateData);
        setEvents(Array.isArray(eventsData) ? eventsData : []);
      })
      .catch((err) => {
        // Resilient Fallback: if server is unreachable or 404, check if this is a known demo preset
        const fallback = DEMO_FALLBACKS[normId] || DEMO_FALLBACKS[shipmentId];
        if (fallback && fallback.length > 0) {
          const reconstructed = foldEventsUpTo(fallback, null);
          setShipmentData(reconstructed);
          setEvents(fallback);
          setError(null);
        } else {
          setError(err);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [shipmentId]);

  const handleViewModeChange = (newMode) => {
    setViewMode(newMode);
    if (newMode === 'live') {
      setIsPlaying(false);
      setReplayStep(null);
    } else if (newMode === 'historical') {
      // Default to the first step or latest step when entering historical mode
      setReplayStep(events.length > 0 ? events.length : 1);
    }
  };

  const handleStepChange = (step) => {
    setViewMode('historical');
    setReplayStep(step);
  };

  const handlePlayToggle = (overrideVal) => {
    if (viewMode === 'live') {
      setViewMode('historical');
      if ((!replayStep || replayStep >= events.length) && events.length > 0) {
        setReplayStep(1);
      }
      setIsPlaying(true);
      return;
    }

    if (typeof overrideVal === 'boolean') {
      setIsPlaying(overrideVal);
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (replayStep >= events.length && events.length > 0) {
        setReplayStep(1);
      }
      setIsPlaying(true);
    }
  };

  // Determine what state data to show: folded replay or backend reconstructed
  const isHistoricalActive = viewMode === 'historical' && replayStep !== null;
  const displayedState = isHistoricalActive
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

      {/* Day 15 & Day 19: Time-Travel Control Bar & Automated Playback Controls */}
      {!loading && !error && events.length > 0 && (
        <TimeSlider
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          totalEvents={events.length}
          currentStep={replayStep || events.length}
          onStepChange={handleStepChange}
          events={events}
          isPlaying={isPlaying}
          onPlayToggle={handlePlayToggle}
          playbackSpeed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          isLooping={isLooping}
          onLoopToggle={() => setIsLooping(!isLooping)}
        />
      )}

      {/* Day 18 & Day 19: Visual Historical State Diff Indicator & Simulation Controls */}
      {!loading && !error && displayedState && shipmentData && isHistoricalActive && (
        <StateDiffIndicator
          historicalState={displayedState}
          liveState={shipmentData}
          currentVersion={replayStep || events.length}
          totalVersions={events.length}
          activeEvent={replayStep && events[replayStep - 1] ? events[replayStep - 1] : null}
          onFastForward={() => handleViewModeChange('live')}
          onRewind={() => handleStepChange(1)}
          onStepChange={handleStepChange}
          isPlaying={isPlaying}
          onPlayToggle={handlePlayToggle}
        />
      )}

      {/* Main Forensic Content */}
      {!loading && !error && displayedState && (
        <ShipmentState
          data={displayedState}
          eventCount={events.length}
          isReplaying={isHistoricalActive}
          currentStep={replayStep}
          activeEvent={replayStep && events[replayStep - 1] ? events[replayStep - 1] : null}
        />
      )}

      {/* Day 18: Global Maritime Route & Live Location Radar Map */}
      {!loading && !error && displayedState && (
        <ShipmentMap
          shipment={shipmentId}
          activeState={displayedState}
          events={events}
          currentStep={replayStep || events.length}
          totalEvents={events.length}
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
            onStepChange={handleStepChange}
          />
        </div>
      )}
    </div>
  );
}

export default ShipmentDetails;