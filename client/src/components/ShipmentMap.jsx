import React, { useState, useMemo } from 'react';
import {
  MAJOR_PORTS,
  resolvePortLocation,
  latLonToSvg,
  interpolateVesselPosition,
  formatNauticalCoordinates
} from '../utils/geoCoordinates';
import './ShipmentMap.css';

/**
 * Interactive Live Location / Maritime Voyage Route Map (Day 18)
 *
 * Renders an offline-capable, high-precision SVG vector map of global maritime shipping lanes.
 * Features:
 *  - Interpolated vessel positioning aligned with event time-scrubbing
 *  - Thermal anomaly radar beacon
 *  - Dynamic route Great-Circle arc
 *  - Port waypoints with interactive telemetry HUD
 *  - Responsive glassmorphic container with 6-theme compliance
 */
export default function ShipmentMap({
  shipment,
  activeState,
  events = [],
  currentStep = null,
  totalEvents = 0
}) {
  const [hoveredPort, setHoveredPort] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showAllPorts, setShowAllPorts] = useState(false);

  // Extract origin, destination, cargo, vessel, temperature from activeState or events
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

  // Determine voyage progress: 0 (origin) to 1 (destination)
  const total = totalEvents > 0 ? totalEvents : Math.max(1, events.length);
  const step = currentStep !== null ? currentStep : total;
  const progressRatio = total > 1 ? Math.min(1, Math.max(0, (step - 1) / (total - 1))) : 1;

  // Compute live vessel coordinates
  const vesselGeo = useMemo(() => {
    // If state location is explicitly a known port, center there
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

  // Project coordinates to SVG space (1000 x 500)
  const originSvg = useMemo(() => latLonToSvg(originPort.lat, originPort.lon), [originPort]);
  const destSvg = useMemo(() => latLonToSvg(destPort.lat, destPort.lon), [destPort]);
  const vesselSvg = useMemo(() => latLonToSvg(vesselGeo.lat, vesselGeo.lon), [vesselGeo]);

  // Calculate curved Great-Circle route path
  const routeSvgPath = useMemo(() => {
    const midX = (originSvg.x + destSvg.x) / 2;
    // Curve slightly upward in the northern hemisphere
    const curveOffset = Math.abs(destSvg.x - originSvg.x) > 300 ? -60 : -35;
    const midY = (originSvg.y + destSvg.y) / 2 + curveOffset;
    return `M ${originSvg.x} ${originSvg.y} Q ${midX} ${midY} ${destSvg.x} ${destSvg.y}`;
  }, [originSvg, destSvg]);

  // Telemetry indicators
  const temp = activeState?.temperature;
  const hasTempAnomaly = temp != null && temp > 8.0;
  const vesselName = activeState?.vessel || 'Vessel Assigned En Route';
  const status = activeState?.status || 'IN_TRANSIT';

  // Format progress percentage
  const progressPercent = Math.round(progressRatio * 100);

  return (
    <div className="shipment-map-card">
      {/* Ambient Radial Glow */}
      <div className="shipment-map-glow" />

      {/* Map Header & Controls */}
      <div className="shipment-map-header">
        <div className="map-header-left">
          <div className="map-live-pill">
            <span className={`map-radar-pulse ${hasTempAnomaly ? 'map-radar-pulse--alert' : ''}`} />
            <span className="map-live-text">GLOBAL MARITIME RADAR · AIS LIVE TRACKING</span>
          </div>
          <h3 className="map-title">Voyage Telemetry & Vessel Geolocation</h3>
          <p className="map-subtitle">Real-time GPS/AIS corridor projection linked to cryptographic event versions</p>
        </div>

        <div className="map-header-controls">
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

      {/* Main Vector Map Canvas */}
      <div className="shipment-map-viewport">
        <svg
          viewBox="0 0 1000 500"
          className="shipment-map-svg"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Interactive Maritime Voyage Map"
        >
          <defs>
            {/* Gradients */}
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

          {/* Ocean Background */}
          <rect width="1000" height="500" className="map-ocean" />

          {/* Coordinate Grid (Meridians & Parallels) */}
          {showGrid && (
            <g className="map-grid-layer" opacity="0.25">
              {/* Parallels (Latitudes) */}
              <line x1="0" y1="83.3" x2="1000" y2="83.3" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="0" y1="166.6" x2="1000" y2="166.6" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="0" y1="250" x2="1000" y2="250" stroke="currentColor" strokeWidth="1.2" /> {/* Equator */}
              <line x1="0" y1="333.3" x2="1000" y2="333.3" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="0" y1="416.6" x2="1000" y2="416.6" stroke="currentColor" strokeDasharray="3,6" />

              {/* Meridians (Longitudes) */}
              <line x1="166.6" y1="0" x2="166.6" y2="500" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="333.3" y1="0" x2="333.3" y2="500" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="500" y1="0" x2="500" y2="500" stroke="currentColor" strokeWidth="1.2" /> {/* Prime Meridian */}
              <line x1="666.6" y1="0" x2="666.6" y2="500" stroke="currentColor" strokeDasharray="3,6" />
              <line x1="833.3" y1="0" x2="833.3" y2="500" stroke="currentColor" strokeDasharray="3,6" />

              {/* Coordinate Labels */}
              <text x="505" y="245" className="grid-label">0° (Equator)</text>
              <text x="505" y="20" className="grid-label">0° (Prime Meridian)</text>
            </g>
          )}

          {/* Continents & Landmass Silhouettes */}
          <g className="map-landmasses" opacity="0.6">
            {/* North America */}
            <path d="M 120 70 L 220 50 L 290 80 L 260 140 L 220 180 L 190 230 L 160 210 L 120 130 Z" />
            <path d="M 230 40 L 280 30 L 290 60 L 250 65 Z" /> {/* Greenland */}
            {/* South America */}
            <path d="M 230 240 L 300 250 L 330 310 L 280 420 L 250 440 L 220 370 L 210 280 Z" />
            {/* Eurasia */}
            <path d="M 470 70 L 540 50 L 670 50 L 800 65 L 890 100 L 910 160 L 860 180 L 810 230 L 730 220 L 690 200 L 620 180 L 560 180 L 490 150 L 460 110 Z" />
            <path d="M 450 80 L 475 75 L 470 95 Z" /> {/* UK */}
            <path d="M 875 135 L 895 145 L 880 170 Z" /> {/* Japan */}
            {/* Africa */}
            <path d="M 460 180 L 550 175 L 590 230 L 560 330 L 520 380 L 470 320 L 440 240 L 450 190 Z" />
            <path d="M 585 300 L 600 295 L 595 330 Z" /> {/* Madagascar */}
            {/* Australia */}
            <path d="M 780 290 L 870 295 L 890 350 L 840 400 L 780 370 L 760 320 Z" />
            {/* Maritime archipelagos */}
            <circle cx="790" cy="245" r="5" />
            <circle cx="820" cy="255" r="4" />
            <circle cx="850" cy="230" r="4" />
          </g>

          {/* Shipping Lane Network Corridor */}
          <g className="map-shipping-lanes" opacity="0.3">
            <path d="M 837 163 Q 780 230 512 106" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,8" fill="none" />
            <path d="M 837 163 Q 790 240 721 230" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,8" fill="none" />
            <path d="M 721 230 Q 580 220 512 106" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,8" fill="none" />
            <path d="M 887 151 Q 500 100 171 156" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,8" fill="none" />
          </g>

          {/* Active Shipment Route Arc */}
          <g className="map-active-route">
            {/* Route Glow Halo */}
            <path
              d={routeSvgPath}
              stroke="url(#routeGradient)"
              strokeWidth="4"
              strokeOpacity="0.4"
              fill="none"
              filter="url(#mapGlow)"
            />
            {/* Route Core Dashline */}
            <path
              d={routeSvgPath}
              stroke="url(#routeGradient)"
              strokeWidth="2.5"
              strokeDasharray="6,4"
              className="route-pulse-dash"
              fill="none"
            />
          </g>

          {/* Global Maritime Hubs (Conditional) */}
          {showAllPorts && (
            <g className="map-all-ports">
              {Object.values(MAJOR_PORTS).map((p) => {
                const pt = latLonToSvg(p.lat, p.lon);
                const isOrigin = p.id === originPort.id;
                const isDest = p.id === destPort.id;
                if (isOrigin || isDest) return null; // Handled separately
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

          {/* Origin Port Pin & Radar Ring */}
          <g
            className="port-marker port-marker--origin"
            transform={`translate(${originSvg.x}, ${originSvg.y})`}
            onMouseEnter={() => setHoveredPort(originPort)}
            onMouseLeave={() => setHoveredPort(null)}
          >
            <circle r="12" className="port-ping port-ping--origin" />
            <circle r="6" fill="#10b981" stroke="#047857" strokeWidth="2" />
            <text y="-14" textAnchor="middle" className="port-label port-label--origin">
              ⚓ ORIGIN: {originPort.name}
            </text>
          </g>

          {/* Destination Port Pin & Radar Ring */}
          <g
            className="port-marker port-marker--destination"
            transform={`translate(${destSvg.x}, ${destSvg.y})`}
            onMouseEnter={() => setHoveredPort(destPort)}
            onMouseLeave={() => setHoveredPort(null)}
          >
            <circle r="12" className="port-ping port-ping--dest" />
            <circle r="6" fill="#818cf8" stroke="#4f46e5" strokeWidth="2" />
            <text y="-14" textAnchor="middle" className="port-label port-label--dest">
              🏁 DEST: {destPort.name}
            </text>
          </g>

          {/* Dynamic Live Vessel Marker */}
          <g
            className="vessel-marker"
            transform={`translate(${vesselSvg.x}, ${vesselSvg.y})`}
          >
            {/* Vessel Radar Sweep Halo */}
            <circle
              r="22"
              className={`vessel-radar-halo ${hasTempAnomaly ? 'vessel-radar-halo--alert' : ''}`}
            />
            <circle
              r="14"
              fill={hasTempAnomaly ? 'url(#vesselGlowAlert)' : 'url(#vesselGlowNormal)'}
            />

            {/* Vessel Ship Silhouette / Heading Pointer */}
            <polygon
              points="0,-8 6,6 0,3 -6,6"
              fill={hasTempAnomaly ? '#ef4444' : '#38bdf8'}
              stroke="#0f172a"
              strokeWidth="1.5"
              transform={`rotate(${vesselGeo.heading})`}
            />

            {/* Live Vessel Tag */}
            <g transform="translate(0, 22)">
              <rect
                x="-65"
                y="-10"
                width="130"
                height="20"
                rx="10"
                className={`vessel-tag-bg ${hasTempAnomaly ? 'vessel-tag-bg--alert' : ''}`}
              />
              <text x="0" y="3.5" textAnchor="middle" className="vessel-tag-text">
                🚢 {vesselName.substring(0, 16)}
              </text>
            </g>
          </g>
        </svg>

        {/* Hover Port Tooltip HUD */}
        {hoveredPort && (
          <div className="map-port-tooltip">
            <span className="tooltip-title">{hoveredPort.name}</span>
            <span className="tooltip-country">📍 {hoveredPort.country} · {hoveredPort.region}</span>
            <span className="tooltip-coords">{formatNauticalCoordinates(hoveredPort.lat, hoveredPort.lon)}</span>
          </div>
        )}
      </div>

      {/* Live Nautical Telemetry HUD Footer */}
      <div className="shipment-map-hud">
        {/* Vessel Position Card */}
        <div className="hud-cell">
          <span className="hud-label">LIVE AIS VESSEL POSITION</span>
          <div className="hud-value-row">
            <span className="hud-coords-value">{formatNauticalCoordinates(vesselGeo.lat, vesselGeo.lon)}</span>
            <span className="hud-heading-badge">{vesselGeo.heading}° HEADING</span>
          </div>
        </div>

        {/* Route Progress Card */}
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

        {/* Active Telemetry Status */}
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
