import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const FEATURE_PILLARS = [
  {
    icon: '🔒',
    title: 'Append-Only Event Sourcing',
    desc: 'State is never mutated or overwritten in-place. Every state transition is recorded as an immutable domain event in MongoDB with strict monotonic versioning.',
    tag: 'Zero Mutation'
  },
  {
    icon: '⚡',
    title: 'CQRS Architecture',
    desc: 'Complete architectural decoupling between Command writes (/api/shipments/commands) and Query reads. Eliminates locking and scales high-frequency telemetry.',
    tag: 'Separation of Concerns'
  },
  {
    icon: '⏳',
    title: 'Point-In-Time Replay Engine',
    desc: 'Scrub backwards to any previous version, inspect state diffs, execute step-by-step playback at 1x-5x speeds, and jump directly to critical anomaly events.',
    tag: 'Deterministic Replay'
  },
  {
    icon: '🛰️',
    title: 'AIS Geolocation & Maritime Radar',
    desc: 'Real-time and historical vessel tracking along Great-Circle oceanic shipping lanes with port pins, corridor waypoints, and automated temperature alert blips.',
    tag: 'Corridor Tracking'
  }
];

const SHOWCASE_SHIPMENTS = [
  {
    id: 'SHIP-001',
    title: 'Shanghai → Rotterdam Standard Freight',
    status: 'ARRIVED',
    origin: 'Port of Shanghai, China',
    destination: 'Port of Rotterdam, Netherlands',
    events: 4,
    vessel: 'MV Pacific Voyager',
    cargo: 'Consumer Electronics & Microchips',
    badge: 'Nominal Voyage',
    color: 'emerald'
  },
  {
    id: 'SHIP-TEMP-ALERT',
    title: 'Trans-Pacific Cold Chain Breach',
    status: 'ALERT',
    origin: 'Port of Tokyo, Japan',
    destination: 'Port of Los Angeles, USA',
    events: 3,
    vessel: 'MV Ocean Arctic',
    cargo: 'Vaccines & Biopharmaceuticals',
    badge: 'Thermal Breach Detected',
    color: 'amber'
  },
  {
    id: 'CONT-GENESIS-99',
    title: 'New Container Genesis Inception',
    status: 'CREATED',
    origin: 'Port of Singapore',
    destination: 'Port of Antwerp, Belgium',
    events: 1,
    vessel: 'Vessel Unassigned (At Dock)',
    cargo: 'Industrial Automation Sensors',
    badge: 'OCC v0 Inception',
    color: 'cyan'
  }
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shipment/${searchQuery.trim()}`);
    }
  };

  return (
    <div className="home-container">
      {/* Dynamic Ambient Background Glows */}
      <div className="home-glow home-glow--top" />
      <div className="home-glow home-glow--bottom" />

      {/* Hero Section */}
      <section className="home-hero">
        <div className="hero-pill">
          <span className="hero-pill__blip" />
          <span>CRYPTOGRAPHIC EVENT SOURCING & MARITIME FORENSICS</span>
        </div>

        <h1 className="hero-title">
          TRUST NOTHING. <br />
          <span className="hero-title__gradient">REPLAY EVERYTHING.</span>
        </h1>

        <p className="hero-description">
          The next-generation forensic audit platform for global supply chain logistics.
          Shipment states are never stored as mutable rows — they are reconstructed deterministically
          on-demand by replaying cryptographically linked historical events.
        </p>

        {/* Quick Shipment Lookup Bar directly in Hero */}
        <form onSubmit={handleSearchSubmit} className="hero-search-form">
          <div className="hero-search-input-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="hero-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Shipment or Container ID (e.g. SHIP-001, SHIP-TEMP-ALERT)..."
            />
            <button type="submit" className="hero-search-btn">
              <span>Inspect Ledger</span>
              <span className="btn-arrow">→</span>
            </button>
          </div>
        </form>

        {/* Hero CTAs */}
        <div className="hero-actions">
          <Link to="/dashboard" className="cta-btn cta-btn--primary">
            <span className="btn-icon">⚡</span>
            <span>Launch Forensic Console</span>
          </Link>
          <Link to="/login" className="cta-btn cta-btn--secondary">
            <span className="btn-icon">🔐</span>
            <span>Operator Portal</span>
          </Link>
          <Link to="/shipment/SHIP-001" className="cta-btn cta-btn--tertiary">
            <span className="btn-icon">🛰️</span>
            <span>Inspect Live AIS Radar</span>
          </Link>
        </div>

        {/* Metrics Counter Strip */}
        <div className="metrics-strip">
          <div className="metric-box">
            <span className="metric-number">0</span>
            <span className="metric-label">In-Place Overwrites</span>
            <span className="metric-sub">Pure Append-Only Log</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-box">
            <span className="metric-number">&lt; 5ms</span>
            <span className="metric-label">Memory Replay Latency</span>
            <span className="metric-sub">Pure Event Folding</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-box">
            <span className="metric-number">100%</span>
            <span className="metric-label">OCC Version Guard</span>
            <span className="metric-sub">Zero Concurrency Race</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-box">
            <span className="metric-number">6</span>
            <span className="metric-label">Radar Color Themes</span>
            <span className="metric-sub">Cyber, Black, Enterprise+</span>
          </div>
        </div>
      </section>

      {/* Architectural Pillars Section */}
      <section className="home-pillars">
        <div className="section-header">
          <span className="section-tag">CORE ARCHITECTURE</span>
          <h2 className="section-title">Built on Mathematical Immutability</h2>
          <p className="section-subtitle">
            Engineered for high-assurance logistics where data tampering or missing context is not an option.
          </p>
        </div>

        <div className="pillars-grid">
          {FEATURE_PILLARS.map((p, idx) => (
            <div key={idx} className="pillar-card">
              <div className="pillar-icon">{p.icon}</div>
              <span className="pillar-tag">{p.tag}</span>
              <h3 className="pillar-title">{p.title}</h3>
              <p className="pillar-desc">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Showcase Shipments */}
      <section className="home-showcase">
        <div className="section-header">
          <span className="section-tag">VERIFIED LEDGER EXAMPLES</span>
          <h2 className="section-title">Sample Shipping Ledgers Available Now</h2>
          <p className="section-subtitle">
            Explore ready-to-replay audit streams across normal, anomalous, and newly initialized voyages.
          </p>
        </div>

        <div className="showcase-grid">
          {SHOWCASE_SHIPMENTS.map((s) => (
            <div
              key={s.id}
              className={`showcase-card showcase-card--${s.color}`}
              onClick={() => navigate(`/shipment/${s.id}`)}
            >
              <div className="showcase-card__header">
                <span className="showcase-id">{s.id}</span>
                <span className="showcase-badge">{s.badge}</span>
              </div>
              <h3 className="showcase-title">{s.title}</h3>
              <div className="showcase-details">
                <div className="showcase-row">
                  <span className="row-label">Route:</span>
                  <span className="row-value">{s.origin} → {s.destination}</span>
                </div>
                <div className="showcase-row">
                  <span className="row-label">Vessel:</span>
                  <span className="row-value">{s.vessel}</span>
                </div>
                <div className="showcase-row">
                  <span className="row-label">Cargo:</span>
                  <span className="row-value">{s.cargo}</span>
                </div>
                <div className="showcase-row">
                  <span className="row-label">Events Tracked:</span>
                  <span className="row-value">{s.events} Monotonic Versions</span>
                </div>
              </div>
              <div className="showcase-action">
                <span>Launch Replay Investigation</span>
                <span className="arrow">→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* End-to-End Workflow Diagram */}
      <section className="home-workflow">
        <div className="section-header">
          <span className="section-tag">FORENSIC PIPELINE</span>
          <h2 className="section-title">From Physical Event to Reconstructed State</h2>
        </div>

        <div className="workflow-steps">
          <div className="step-card">
            <span className="step-num">01</span>
            <h4 className="step-title">Command Ingestion</h4>
            <p className="step-desc">
              Commands validated with OCC expectedVersion guards to prevent write conflicts.
            </p>
          </div>
          <div className="step-connector">→</div>
          <div className="step-card">
            <span className="step-num">02</span>
            <h4 className="step-title">Immutable Event Store</h4>
            <p className="step-desc">
              Events appended sequentially to MongoDB with cryptographic UUIDs and timestamps.
            </p>
          </div>
          <div className="step-connector">→</div>
          <div className="step-card">
            <span className="step-num">03</span>
            <h4 className="step-title">Pure In-Memory Fold</h4>
            <p className="step-desc">
              State reconstructed instantly on the client or server without stale read replicas.
            </p>
          </div>
          <div className="step-connector">→</div>
          <div className="step-card">
            <span className="step-num">04</span>
            <h4 className="step-title">Forensic Radar & Replay</h4>
            <p className="step-desc">
              Interactive timeline scrubbing, AIS GPS tracking, and thermal anomaly alerts.
            </p>
          </div>
        </div>
      </section>

      {/* Operator & Team Credits */}
      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="brand-icon">📦</span>
            <span className="brand-name">
              AUDIT<span className="brand-accent">TRAIL</span>
            </span>
            <span className="brand-version">v1.0 · Day 23</span>
          </div>

          <div className="footer-team">
            <div className="team-member">
              <span className="team-role">Lead Forensic Analyst (Person 3):</span>
              <span className="team-name">Aman Kumar</span>
            </div>
            <div className="team-divider" />
            <div className="team-member">
              <span className="team-role">Chief Architect & Tech Lead:</span>
              <span className="team-name">Raushan Kumar</span>
            </div>
          </div>

          <div className="footer-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/login">Operator Login</Link>
            <Link to="/shipment/SHIP-001">Demo Replay</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
