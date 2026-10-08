import React, { useState, useMemo } from 'react';
import {
  MAJOR_PORTS,
  resolvePortLocation,
  latLonToSvg,
  interpolateVesselPosition,
  formatNauticalCoordinates,
  getRouteCorridorLocations,
  resolveVesselCurrentLocationName,
  CORRIDOR_WAYPOINTS
} from '../utils/geoCoordinates';
import { shouldShowHistoricalWatermark } from '../utils/historicalAlerts';
import './ShipmentMap.css';

export default function ShipmentMap({
  shipment,
  activeState,
  events = [],
  currentStep = null,
  totalEvents = 0,
  isHistorical = false
}) {
  const [hoveredPort, setHoveredPort] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showAllPorts, setShowAllPorts] = useState(false);
  const [showLocationNames, setShowLocationNames] = useState(true);

  const genesisEvent = events && events.length > 0 ? events[0] : null;
  const terminalEvent = events && events.length > 0 ? events[events.length - 1] : null;

  const rawOrigin = genesisEvent?.payload?.origin || activeState?.location || 'Port of Shanghai';
  const rawDestination = genesisEvent?.payload?.destination || terminalEvent?.payload?.port || 'Port of Rotterdam';

  const originPort = useMemo(() => {
    return resolvePortLocation(rawOrigin) || MAJOR_PORTS.SHANGHAI;
  }, [rawOrigin]);

  const destPort = useMemo(() => {
    return resolvePortLocation(rawDestination) || MAJOR_PORTS.ROTTERDAM;
  }, [rawDestination]);

  const total = totalEvents > 0 ? totalEvents : Math.max(1, events.length);
  const step = currentStep !== null ? currentStep : total;
  const progressRatio = total > 1 ? Math.min(1, Math.max(0, (step - 1) / (total - 1))) : 1;

  const corridorLocations = useMemo(() => {
    return getRouteCorridorLocations(originPort, destPort);
  }, [originPort, destPort]);

  const routeWaypoints = useMemo(() => {
    return corridorLocations.filter((loc) => loc.type === 'WAYPOINT');
  }, [corridorLocations]);

  const vesselGeo = useMemo(() => {

    const locMatch = resolvePortLocation(activeState?.location);
    if (step === 1 && originPort) {
      return { lat: originPort.lat, lon: originPort.lon, heading: 90 };
    }
    if (step === total && destPort) {
      return { lat: destPort.lat, lon: destPort.lon, heading: 0 };
    }
    if (locMatch && step === total) {
      return { lat: locMatch.lat, lon: locMatch.lon, heading: 0 };
    }
    return interpolateVesselPosition(originPort, destPort, progressRatio);
  }, [originPort, destPort, progressRatio, activeState?.location, step, total]);

  const vesselLocationName = useMemo(() => {
    return resolveVesselCurrentLocationName(vesselGeo, originPort, destPort, progressRatio, activeState);
  }, [vesselGeo, originPort, destPort, progressRatio, activeState]);

  const originSvg = useMemo(() => latLonToSvg(originPort.lat, originPort.lon), [originPort]);
  const destSvg = useMemo(() => latLonToSvg(destPort.lat, destPort.lon), [destPort]);
  const vesselSvg = useMemo(() => latLonToSvg(vesselGeo.lat, vesselGeo.lon), [vesselGeo]);

  const routeSvgPath = useMemo(() => {
    const midX = (originSvg.x + destSvg.x) / 2;

    const curveOffset = Math.abs(destSvg.x - originSvg.x) > 300 ? -60 : -35;
    const midY = (originSvg.y + destSvg.y) / 2 + curveOffset;
    return `M ${originSvg.x} ${originSvg.y} Q ${midX} ${midY} ${destSvg.x} ${destSvg.y}`;
  }, [originSvg, destSvg]);

  const temp = activeState?.temperature;
  const hasTempAnomaly = temp != null && temp > 8.0;
  const vesselName = activeState?.vessel || 'Vessel Assigned En Route';
  const status = activeState?.status || 'IN_TRANSIT';

  const progressPercent = Math.round(progressRatio * 100);

  const isHistoricalReplay = shouldShowHistoricalWatermark(step, total, isHistorical);

  return (
    <div className={`shipment-map-card ${isHistoricalReplay ? 'shipment-map-card--historical' : ''}`}>

      <div className="shipment-map-glow" />

      <div className="shipment-map-header">
        <div className="map-header-left">
          <div className={`map-live-pill ${isHistoricalReplay ? 'map-live-pill--historical' : ''}`}>
            <span className={`map-radar-pulse ${hasTempAnomaly ? 'map-radar-pulse--alert' : ''} ${isHistoricalReplay ? 'map-radar-pulse--historical' : ''}`} />
            <span className="map-live-text">
              {isHistoricalReplay
                ? `HISTORICAL AIS REPLAY · POINT-IN-TIME TRACK (v${step})`
                : 'GLOBAL MARITIME RADAR · AIS LIVE TRACKING'}
            </span>

          </div>

          <h3 className="map-title">Voyage Telemetry & Vessel Geolocation</h3>

          <p className="map-subtitle">
            {isHistoricalReplay
              ? `Reconstructing historical ocean coordinates at sequence version ${step} of ${total}`
              : 'Real-time GPS/AIS corridor projection linked to cryptographic event versions'}
          </p>

        </div>

        <div className="map-header-controls">
          <button
            type="button"
            className={`map-control-btn ${showLocationNames ? 'map-control-btn--active' : ''}`}
            onClick={() => setShowLocationNames(!showLocationNames)}
            title="Toggle Route Location Names & Labels"
          >
            🏷️ Locations {showLocationNames ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            className={`map-control-btn ${showGrid ? 'map-control-btn--active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Nautical Coordinate Grid"
          >
            🌐 Grid {showGrid ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            className={`map-control-btn ${showAllPorts ? 'map-control-btn--active' : ''}`}
            onClick={() => setShowAllPorts(!showAllPorts)}
            title="Toggle All World Maritime Hubs"
          >
            ⚓ Hubs {showAllPorts ? 'ALL' : 'ROUTE'}
          </button>

        </div>

      </div>

      <div className="shipment-map-viewport">

        {isHistoricalReplay && (
          <div className="map-historical-watermark" role="status" aria-live="polite">
            <span className="watermark-icon">⚠</span>

            <div className="watermark-body">
              <span className="watermark-title">HISTORICAL AIS POSITION (v{step}/{total})</span>

              <span className="watermark-sub">Point-in-time replay · Not live vessel location</span>

            </div>

          </div>

        )}

        <svg
          viewBox="0 0 1000 500"
          className="shipment-map-svg"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Interactive Maritime Voyage Map"
        >
          <defs>

            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.9" />
            </linearGradient>

            <radialGradient id="vesselGlowNormal" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="vesselGlowAlert" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>

            <filter id="mapGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

          </defs>

          <rect width="1000" height="500" className="map-ocean" />

          {showGrid && (
            <g className="map-grid-layer" opacity="0.25">

              <line x1="0" y1="83.3" x2="1000" y2="83.3" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="0" y1="166.6" x2="1000" y2="166.6" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="0" y1="250" x2="1000" y2="250" stroke="currentColor" strokeWidth="1.2" />
              <line x1="0" y1="333.3" x2="1000" y2="333.3" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="0" y1="416.6" x2="1000" y2="416.6" stroke="currentColor" strokeDasharray="3,6" />

              <line x1="166.6" y1="0" x2="166.6" y2="500" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="333.3" y1="0" x2="333.3" y2="500" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="500" y1="0" x2="500" y2="500" stroke="currentColor" strokeWidth="1.2" />
              <line x1="666.6" y1="0" x2="666.6" y2="500" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="833.3" y1="0" x2="833.3" y2="500" stroke="currentColor" strokeDasharray="3,6" />

              <text x="505" y="245" className="grid-label">0° (Equator)</text>

              <text x="505" y="20" className="grid-label">0° (Prime Meridian)</text>

            </g>

          )}

          <g className="map-landmasses" opacity="0.6">

            <path d="M 120 70 L 220 50 L 290 80 L 260 140 L 220 180 L 190 230 L 160 210 L 120 130 Z" />
            <path d="M 230 40 L 280 30 L 290 60 L 250 65 Z" />

            <path d="M 230 240 L 300 250 L 330 310 L 280 420 L 250 440 L 220 370 L 210 280 Z" />

            <path d="M 470 70 L 540 50 L 670 50 L 800 65 L 890 100 L 910 160 L 860 180 L 810 230 L 730 220 L 690 200 L 620 180 L 560 180 L 490 150 L 460 110 Z" />
            <path d="M 450 80 L 475 75 L 470 95 Z" />
            <path d="M 875 135 L 895 145 L 880 170 Z" />

            <path d="M 460 180 L 550 175 L 590 230 L 560 330 L 520 380 L 470 320 L 440 240 L 450 190 Z" />
            <path d="M 585 300 L 600 295 L 595 330 Z" />

            <path d="M 780 290 L 870 295 L 890 350 L 840 400 L 780 370 L 760 320 Z" />

            <circle cx="790" cy="245" r="5" />
            <circle cx="820" cy="255" r="4" />
            <circle cx="850" cy="230" r="4" />
          </g>

          <g className="map-shipping-lanes" opacity="0.3">
            <path d="M 837 163 Q 780 230 512 106" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,8" fill="none" />
            <path d="M 837 163 Q 790 240 721 230" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,8" fill="none" />
            <path d="M 721 230 Q 580 220 512 106" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,8" fill="none" />
            <path d="M 887 151 Q 500 100 171 156" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,8" fill="none" />
          </g>

          <g className="map-active-route">

            <path
              d={routeSvgPath}
              stroke="url(#routeGradient)"
              strokeWidth="4"
              strokeOpacity="0.4"
              fill="none"
              filter="url(#mapGlow)"
            />

            <path
              d={routeSvgPath}
              stroke="url(#routeGradient)"
              strokeWidth="2.5"
              strokeDasharray="6,4"
              className="route-pulse-dash"
              fill="none"
            />
          </g>

          {showAllPorts && (
            <g className="map-all-ports">
              {Object.values(MAJOR_PORTS).map((p) => {
                const pt = latLonToSvg(p.lat, p.lon);
                const isOrigin = p.id === originPort.id;
                const isDest = p.id === destPort.id;
                if (isOrigin || isDest) return null;
                return (
                  <g
                    key={p.id}
                    className="port-marker-passive"
                    transform={`translate(${pt.x}, ${pt.y})`}
                    onMouseEnter={() => setHoveredPort(p)}
                    onMouseLeave={() => setHoveredPort(null)}
                  >
                    <circle r="3" fill="#64748b" opacity="0.7" />
                    <text y="-6" textAnchor="middle" className="port-tag-text">{p.name}</text>

                  </g>

                );
              })}
            </g>

          )}

          {routeWaypoints.map((wp) => {
            const pt = latLonToSvg(wp.lat, wp.lon);
            return (
              <g
                key={wp.id}
                className="waypoint-marker"
                transform={`translate(${pt.x}, ${pt.y})`}
                onMouseEnter={() => setHoveredPort(wp)}
                onMouseLeave={() => setHoveredPort(null)}
              >
                <circle r="3.5" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.5" />
                <circle r="7" className="waypoint-ping" />
                {showLocationNames && (
                  <g transform="translate(0, -9)" className="map-location-tag">
                    <rect
                      x="-55"
                      y="-10"
                      width="110"
                      height="15"
                      rx="3"
                      className="map-location-tag__bg"
                    />
                    <text x="0" y="1" textAnchor="middle" className="map-location-tag__text">
                      📍 {wp.shortName}
                    </text>

                  </g>

                )}
              </g>

            );
          })}

          <g
            className="port-marker port-marker--origin"
            transform={`translate(${originSvg.x}, ${originSvg.y})`}
            onMouseEnter={() => setHoveredPort(originPort)}
            onMouseLeave={() => setHoveredPort(null)}
          >
            <circle r="12" className="port-ping port-ping--origin" />
            <circle r="6" fill="#10b981" stroke="#047857" strokeWidth="2" />
            {showLocationNames && (
              <g transform="translate(0, -16)" className="map-location-tag map-location-tag--origin">
                <rect
                  x="-75"
                  y="-12"
                  width="150"
                  height="18"
                  rx="4"
                  className="map-location-tag__bg map-location-tag__bg--origin"
                />
                <text x="0" y="1" textAnchor="middle" className="port-label port-label--origin">
                  ⚓ ORIGIN: {originPort.name}
                </text>

              </g>

            )}
          </g>

          <g
            className="port-marker port-marker--destination"
            transform={`translate(${destSvg.x}, ${destSvg.y})`}
            onMouseEnter={() => setHoveredPort(destPort)}
            onMouseLeave={() => setHoveredPort(null)}
          >
            <circle r="12" className="port-ping port-ping--dest" />
            <circle r="6" fill="#818cf8" stroke="#4f46e5" strokeWidth="2" />
            {showLocationNames && (
              <g transform="translate(0, -16)" className="map-location-tag map-location-tag--dest">
                <rect
                  x="-80"
                  y="-12"
                  width="160"
                  height="18"
                  rx="4"
                  className="map-location-tag__bg map-location-tag__bg--dest"
                />
                <text x="0" y="1" textAnchor="middle" className="port-label port-label--dest">
                  🏁 DEST: {destPort.name}
                </text>

              </g>

            )}
          </g>

          <g
            className="vessel-marker"
            transform={`translate(${vesselSvg.x}, ${vesselSvg.y})`}
          >

            <circle
              r="22"
              className={`vessel-radar-halo ${hasTempAnomaly ? 'vessel-radar-halo--alert' : ''}`}
            />
            <circle
              r="14"
              fill={hasTempAnomaly ? 'url(#vesselGlowAlert)' : 'url(#vesselGlowNormal)'}
            />

            <polygon
              points="0,-8 6,6 0,3 -6,6"
              fill={hasTempAnomaly ? '#ef4444' : '#38bdf8'}
              stroke="#0f172a"
              strokeWidth="1.5"
              transform={`rotate(${vesselGeo.heading})`}
            />

            <g transform="translate(0, 22)">
              <rect
                x="-95"
                y="-10"
                width="190"
                height="20"
                rx="10"
                className={`vessel-tag-bg ${hasTempAnomaly ? 'vessel-tag-bg--alert' : ''}`}
              />
              <text x="0" y="3.5" textAnchor="middle" className="vessel-tag-text">
                🚢 {vesselName.substring(0, 14)} · 📍 {vesselLocationName.substring(0, 18)}
              </text>

            </g>

          </g>

        </svg>

        {hoveredPort && (
          <div className="map-port-tooltip">
            <span className="tooltip-title">{hoveredPort.name}</span>

            <span className="tooltip-country">📍 {hoveredPort.country} · {hoveredPort.region}</span>

            <span className="tooltip-coords">{formatNauticalCoordinates(hoveredPort.lat, hoveredPort.lon)}</span>

          </div>

        )}
      </div>

      <div className="map-locations-strip">
        <div className="locations-strip__header">
          <div className="strip-header-left">
            <span className="strip-title">NAUTICAL ROUTE LOCATIONS & WAYPOINTS</span>

            <span className="strip-subtitle">
              Verified AIS corridors · Sequence progression synced with forensic event log
            </span>

          </div>

          <div className="strip-vessel-badge">
            <span className="vessel-dot" />
            <span>Active Sector: <strong>{vesselLocationName}</strong></span>
          </div>

        </div>

        <div className="locations-strip__track">
          {corridorLocations.map((loc, idx) => {
            const isPassed =
              loc.type === 'ORIGIN'
                ? true
                : loc.type === 'DESTINATION'
                ? progressRatio >= 0.98
                : (idx / (corridorLocations.length - 1)) <= progressRatio;

            const isCurrent =
              loc.type === 'ORIGIN'
                ? progressRatio <= 0.05
                : loc.type === 'DESTINATION'
                ? progressRatio >= 0.95
                : Math.abs((idx / (corridorLocations.length - 1)) - progressRatio) < 0.15;

            return (
              <div
                key={loc.id}
                className={`location-chip location-chip--${loc.type.toLowerCase()} ${
                  isCurrent ? 'location-chip--current' : isPassed ? 'location-chip--passed' : 'location-chip--upcoming'
                }`}
                onMouseEnter={() => setHoveredPort(loc)}
                onMouseLeave={() => setHoveredPort(null)}
                title={`${loc.name} (${loc.country}) · ${formatNauticalCoordinates(loc.lat, loc.lon)}`}
              >
                <div className="location-chip__top">
                  <span className="chip-badge">
                    {loc.type === 'ORIGIN' ? '⚓ Origin' : loc.type === 'DESTINATION' ? '🏁 Destination' : `📍 WP ${idx}`}
                  </span>

                  <span className="chip-status-dot" />
                </div>

                <div className="chip-name">{loc.name}</div>

                <div className="chip-coords">{formatNauticalCoordinates(loc.lat, loc.lon)}</div>

                <div className="chip-state-label">
                  {isCurrent ? 'Current Sector' : isPassed ? 'Cleared' : 'Pending Waypoint'}
                </div>

              </div>

            );
          })}
        </div>

      </div>

      <div className="shipment-map-hud">

        <div className="hud-cell">
          <div className="hud-split-header">
            <span className="hud-label">
              {isHistoricalReplay ? 'RECORDED AIS POSITION' : 'LIVE AIS VESSEL POSITION'}
            </span>

            {isHistoricalReplay && (
              <span className="hud-historical-tag">HISTORICAL (v{step})</span>

            )}
          </div>

          <div className="hud-value-row">
            <span className="hud-coords-value">{formatNauticalCoordinates(vesselGeo.lat, vesselGeo.lon)}</span>

            <span className="hud-heading-badge">{vesselGeo.heading}° HEADING</span>

          </div>

        </div>

        <div className="hud-cell">
          <div className="hud-split-header">
            <span className="hud-label">VOYAGE CORRIDOR PROGRESS</span>

            <span className="hud-progress-val">{progressPercent}%</span>

          </div>

          <div className="hud-bar-track">
            <div
              className={`hud-bar-fill ${hasTempAnomaly ? 'hud-bar-fill--alert' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <span className="hud-meta-text">
            {progressPercent === 0
              ? 'Docked at Origin'
              : progressPercent === 100
              ? 'Arrived at Destination Port'
              : `Navigating Ocean Corridor (Step ${step}/${total})`}
          </span>

        </div>

        <div className="hud-cell">
          <span className="hud-label">CARGO & SENSOR STATUS</span>

          <div className="hud-status-row">
            <span className={`hud-status-badge hud-status-badge--${(status || '').toLowerCase()}`}>
              {status}
            </span>

            {temp != null ? (
              <span className={`hud-temp-badge ${hasTempAnomaly ? 'hud-temp-badge--alert' : ''}`}>
                🌡 {temp}°C {hasTempAnomaly ? 'ANOMALY' : 'OK'}
              </span>

            ) : (
              <span className="hud-temp-badge">🌡 Nominal</span>

            )}
          </div>

        </div>

      </div>

    </div>

  );
}
