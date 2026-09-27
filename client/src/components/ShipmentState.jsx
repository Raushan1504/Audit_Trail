import './ShipmentState.css';

function getStatusTheme(status) {
  const s = (status || '').toUpperCase();
  if (s === 'ARRIVED') return { label: 'ARRIVED AT PORT', class: 'status--arrived', icon: '🏁' };
  if (s === 'LOADED') return { label: 'IN TRANSIT (VESSEL)', class: 'status--loaded', icon: '🚢' };
  if (s === 'ALERT' || s === 'TEMPERATURE_SPIKE') return { label: 'THERMAL ANOMALY', class: 'status--alert', icon: '🔥' };
  if (s === 'CREATED') return { label: 'CONTAINER REGISTERED', class: 'status--created', icon: '📦' };
  return { label: s || 'UNKNOWN', class: 'status--unknown', icon: '⏱' };
}

function ShipmentState({ data, eventCount = 0, isReplaying = false, currentStep = null }) {
  if (!data) return null;

  const status = data.status || data.state || 'UNKNOWN';
  const theme = getStatusTheme(status);
  const temp = data.temperature;
  const isHighTemp = temp !== undefined && temp !== null && temp > 8;

  return (
    <div className="shipment-state-3d">
      {/* Reconstructed Banner with 3D depth */}
      <div className="shipment-state-3d__header">
        <div className="reconstruction-pill">
          <span className="pulse-dot" />
          <span className="pill-text">STATE RECONSTRUCTED VIA EVENT REPLAY</span>
        </div>
        <div className="event-fold-indicator">
          {isReplaying ? (
            <span className="replaying-tag">⚡ REPLAY IN PROGRESS: Step {currentStep} of {eventCount}</span>
          ) : (
            <span className="folded-tag">Folded from {eventCount} immutable {eventCount === 1 ? 'event' : 'events'}</span>
          )}
        </div>
      </div>

      {/* 3D Main Cards Grid */}
      <div className="shipment-state-3d__grid">
        {/* Status Card */}
        <div className="shipment-card-3d shipment-card-3d--status">
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
        <div className="shipment-card-3d">
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
        <div className="shipment-card-3d">
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
        <div className={`shipment-card-3d ${isHighTemp ? 'shipment-card-3d--temp-spike' : ''}`}>
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