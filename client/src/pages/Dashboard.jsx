import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import './Dashboard.css';

const DEMO_PRESETS = [
  {
    id: 'SHIP-001',
    title: 'Standard Sea Freight',
    status: 'ARRIVED',
    desc: 'Full 4-event sequence: Container Created → Vessel Load → Temperature Spike → Port Arrival',
    tag: 'Full Voyage',
    color: 'emerald'
  },
  {
    id: 'SHIP-TEMP-ALERT',
    title: 'Cold Chain Anomaly',
    status: 'ALERT',
    desc: 'Thermal violation detected during ocean transit. Requires forensic audit inspection.',
    tag: 'Temp Spike',
    color: 'amber'
  },
  {
    id: 'CONT-GENESIS-99',
    title: 'New Container Inception',
    status: 'CREATED',
    desc: 'Genesis event appended. Ready for port loading and voyage scheduling.',
    tag: 'Genesis Block',
    color: 'cyan'
  }
];

function Dashboard() {
  const navigate = useNavigate();

  const handleSearch = (shipmentId) => {
    if (!shipmentId || shipmentId.trim() === '') return;
    navigate(`/shipment/${shipmentId.trim()}`);
  };

  return (
    <div className="dashboard-cinematic">
      {/* 3D Ambient Background Lights */}
      <div className="ambient-glow ambient-glow--top" />
      <div className="ambient-glow ambient-glow--bottom" />

      {/* Cinematic Hero */}
      <header className="dashboard-hero">
        <div className="dashboard-hero__badge">
          <span className="badge-pulse" />
          <span>EVENT SOURCING & CQRS FORENSIC LEDGER</span>
        </div>

        <h1 className="dashboard-hero__title">
          AUDIT <span className="text-gradient">TRAIL</span>
        </h1>

        <p className="dashboard-hero__subtitle">
          Next-generation immutable inventory & logistics ledger. Shipment states are never mutated — they are reconstructed on-demand by replaying historical events.
        </p>

        {/* Live Architecture Status Bar */}
        <div className="architecture-bar">
          <div className="arch-item">
            <span className="arch-icon">🔒</span>
            <div>
              <span className="arch-title">IMMUTABLE LOG</span>
              <span className="arch-detail">Append-Only / No Updates</span>
            </div>
          </div>
          <div className="arch-divider" />
          <div className="arch-item">
            <span className="arch-icon">⚡</span>
            <div>
              <span className="arch-title">CQRS SEPARATION</span>
              <span className="arch-detail">Command & Query Routes</span>
            </div>
          </div>
          <div className="arch-divider" />
          <div className="arch-item">
            <span className="arch-icon">🔄</span>
            <div>
              <span className="arch-title">EVENT REPLAY</span>
              <span className="arch-detail">Pure State Reconstruction</span>
            </div>
          </div>
        </div>
      </header>

      {/* Center Search Console */}
      <section className="dashboard-search-section">
        <SearchBar onSearch={handleSearch} />
      </section>

      {/* Tracked Shipment Presets */}
      <section className="dashboard-presets">
        <div className="presets-header">
          <span className="presets-tag">ACTIVE SHIPMENT LEDGERS</span>
          <h2>Quick Access Shipments</h2>
        </div>

        <div className="presets-grid">
          {DEMO_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className={`preset-card-3d preset-card-3d--${preset.color}`}
              onClick={() => handleSearch(preset.id)}
            >
              <div className="preset-card-3d__glare" />
              <div className="preset-card-3d__top">
                <span className="preset-card__id">{preset.id}</span>
                <span className="preset-card__tag">{preset.tag}</span>
              </div>
              <h3 className="preset-card__title">{preset.title}</h3>
              <p className="preset-card__desc">{preset.desc}</p>
              <div className="preset-card__action">
                <span>Inspect Ledger</span>
                <span className="arrow">→</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;