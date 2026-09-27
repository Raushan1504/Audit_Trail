import './ShipmentState.css';

function getStatusTheme(status) {
  const s = (status || '').toUpperCase();
  if (s === 'ARRIVED') return { label: 'ARRIVED AT PORT', class: 'status--arrived', icon: '🏁' };
  if (s === 'LOADED') return { label: 'IN TRANSIT (VESSEL)', class: 'status--loaded', icon: '🚢' };
  if (s === 'ALERT' || s === 'TEMPERATURE_SPIKE') return { label: 'THERMAL ANOMALY', class: 'status--alert', icon: '🔥' };
  if (s === 'CREATED') return { label: 'CONTAINER REGISTERED', class: 'status--created', icon: '📦' };
  return { label: s || 'UNKNOWN', class: 'status--unknown', icon: '⏱' };
}

function ShipmentState({ data, eventCount = 0, isReplaying = false, currentStep = null, activeEvent = null }) {
  if (!data) return null;

  const status = data.status || data.state || 'UNKNOWN';
  const theme = getStatusTheme(status);
  const temp = data.temperature;
  const isHighTemp = temp !== undefined && temp !== null && temp > 8;
  const stepsBehind = isReplaying && currentStep ? eventCount - currentStep : 0;

  return (
    <div className={`shipment-state-3d ${isReplaying ? 'shipment-state-3d--temporal' : ''}`}>
      {/* Reconstructed Banner with 3D depth */}
      <div className={`shipment-state-3d__header ${isReplaying ? 'shipment-state-3d__header--temporal' : ''}`}>
        <div className="reconstruction-pill">
          <span className={`pulse-dot ${isReplaying ? 'pulse-dot--rewound' : ''}`} />
          <span className="pill-text">
            {isReplaying ? 'HISTORICAL STATE DERIVED VIA POINT-IN-TIME REPLAY' : 'STATE RECONSTRUCTED VIA EVENT REPLAY'}
          </span>
        </div>
        <div className="event-fold-indicator">
          {isReplaying ? (
            <span className="replaying-tag">
              ⚡ POINT-IN-TIME: Version {currentStep} of {eventCount}
              {stepsBehind > 0 ? ` (${stepsBehind} behind head)` : ' (At Head)'}
            </span>
          ) : (
            <span className="folded-tag">Folded from {eventCount} immutable {eventCount === 1 ? 'event' : 'events'}</span>
          )}
        </div>
      </div>

      {/* Temporal Snapshot Details if Replaying */}
      {isReplaying && (
        <div className="temporal-state-banner">
          <div className="temporal-state-badge">
            <span className="temporal-state-badge__dot" />
            <span>POINT-IN-TIME SNAPSHOT: Version {currentStep} of {eventCount}</span>
            {stepsBehind > 0 ? (
              <span className="temporal-state-badge__lag">({stepsBehind} behind live head)</span>
            ) : (
              <span className="temporal-state-badge__sync">✓ In sync with live head</span>
            )}
          </div>
          {activeEvent && (
            <div className="temporal-event-indicator">
              <span className="temporal-event-label">Triggered by:</span>
              <span className="temporal-event-name">{activeEvent.eventType}</span>
              {activeEvent.timestamp && (
                <span className="temporal-event-time">
                  ⏱ {new Date(activeEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3D Main Cards Grid */}
      <div className="shipment-state-3d__grid">
        {/* Status Card */}
        <div
          key={`status-${data.version}`}
          className={`shipment-card-3d shipment-card-3d--status ${isReplaying ? 'shipment-card-3d--temporal-active' : ''}`}
        >
          <div className="shipment-card-3d__glare" />
          <div className="shipment-card-3d__content">
            <span className="card-label">CURRENT OPERATIONAL STATUS</span>
            <div className={`status-pill ${theme.class}`}>
              <span className="status-icon">{theme.icon}</span>
              <span className="status-text">{theme.label}</span>
            </div>
            <span className="card-sub">Calculated via chronological event fold</span>
          </div>
        </div>

        {/* Location & Vessel Card */}
        <div
          key={`loc-${data.version}`}
          className={`shipment-card-3d ${isReplaying ? 'shipment-card-3d--temporal-active' : ''}`}
        >
          <div className="shipment-card-3d__glare" />
          <div className="shipment-card-3d__content">
            <span className="card-label">CURRENT LOCATION & VESSEL</span>
            <div className="location-data">
              <span className="location-name">{data.location || 'In Transit'}</span>
              {data.vessel && (
                <span className="vessel-badge">
                  <span>⚓</span> {data.vessel}
                </span>
              )}
            </div>
            <span className="card-sub">Last reported position milestone</span>
          </div>
        </div>

        {/* Version & Ledger Height Card */}
        <div
          key={`ver-${data.version}`}
          className={`shipment-card-3d ${isReplaying ? 'shipment-card-3d--temporal-active' : ''}`}
        >
          <div className="shipment-card-3d__glare" />
          <div className="shipment-card-3d__content">
            <span className="card-label">LEDGER HEIGHT & VERSION</span>
            <div className="version-display">
              <span className="version-num">v{data.version ?? 'N/A'}</span>
              <span className="block-tag">SEQUENCE #{data.version ?? 0}</span>
            </div>
            <span className="card-sub">Immutable sequence verified</span>
          </div>
        </div>

        {/* Temperature / Cargo Card */}
        <div
          key={`temp-${data.version}`}
          className={`shipment-card-3d ${isHighTemp ? 'shipment-card-3d--temp-spike' : ''} ${isReplaying ? 'shipment-card-3d--temporal-active' : ''}`}
        >
          <div className="shipment-card-3d__glare" />
          <div className="shipment-card-3d__content">
            <span className="card-label">ENVIRONMENTAL TELEMETRY</span>
            <div className="temp-display">
              {temp !== undefined && temp !== null ? (
                <>
                  <span className={`temp-val ${isHighTemp ? 'temp-val--spike' : ''}`}>
                    {temp}°C
                  </span>
                  <span className={`temp-badge ${isHighTemp ? 'temp-badge--alert' : 'temp-badge--safe'}`}>
                    {isHighTemp ? '⚠ THRESHOLD EXCEEDED' : '✓ TEMPERATURE NOMINAL'}
                  </span>
                </>
              ) : (
                <span className="temp-val temp-val--na">No sensor data</span>
              )}
            </div>
            {data.cargo && (
              <div className="cargo-line">
                <span className="cargo-icon">🏷 Cargo:</span>
                <span className="cargo-text">{data.cargo}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShipmentState;