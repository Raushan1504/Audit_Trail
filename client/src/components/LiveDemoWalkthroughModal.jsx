import { useState } from 'react';
import './LiveDemoWalkthroughModal.css';

export default function LiveDemoWalkthroughModal({ isOpen, onClose, onSelectPreset }) {
  const [activeTab, setActiveTab] = useState('case_study');

  if (!isOpen) return null;

  return (
    <div className="demo-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="demo-modal-title">
      <div className="demo-modal-backdrop" onClick={onClose} />
      <div className="demo-modal-container">

        <div className="demo-modal-header">
          <div className="demo-modal-title-group">
            <span className="demo-modal-badge">DAY 28 FINAL DELIVERY</span>

            <h2 id="demo-modal-title">🎓 Live Demo & Forensic Viva Walkthrough</h2>

          </div>

          <button type="button" className="demo-modal-close" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>

        </div>

        <div className="demo-modal-tabs" role="tablist">
          <button
            type="button"
            className={`demo-tab-btn ${activeTab === 'case_study' ? 'demo-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('case_study')}
          >
            📋 Case Study File
          </button>

          <button
            type="button"
            className={`demo-tab-btn ${activeTab === 'steps' ? 'demo-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('steps')}
          >
            🚀 4-Step Demo Script
          </button>

          <button
            type="button"
            className={`demo-tab-btn ${activeTab === 'viva_qa' ? 'demo-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('viva_qa')}
          >
            💡 Viva Q&A Cheat Sheet
          </button>

        </div>

        <div className="demo-modal-body">
          {activeTab === 'case_study' && (
            <div className="demo-tab-content">
              <div className="case-study-hero">
                <span className="case-study-id">INCIDENT FILE #INC-2026-PHARMA-09</span>

                <h3>$1,200,000 USD Pfizer mRNA Cold-Chain Spoilage</h3>

                <p>
                  10,000 vials of mRNA vaccines required strictly maintaining between 2.0°C and 8.0°C.
                  Cargo arrived in Tokyo spoiled. Carrier and port both deny fault. Use the Audit Trail
                  ledger to reconstruct historical facts and assign liability.
                </p>

              </div>

              <div className="demo-presets-grid">
                <div className="demo-preset-card">
                  <h4>📦 Scenario A: Vaccine Cold-Chain</h4>

                  <p>Target: <code>SHIP-PHARMA-2026-EU-JP</code></p>
                  <button
                    type="button"
                    className="preset-btn preset-btn--primary"
                    onClick={() => {
                      if (onSelectPreset) onSelectPreset('SHIP-PHARMA-2026-EU-JP');
                      onClose();
                    }}
                  >
                    Load Vaccine Scenario →
                  </button>

                </div>

                <div className="demo-preset-card">
                  <h4>🌊 Scenario B: Trans-Oceanic Electronics</h4>

                  <p>Target: <code>SHIP-OCEAN-2026-ROT-SGP</code></p>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      if (onSelectPreset) onSelectPreset('SHIP-OCEAN-2026-ROT-SGP');
                      onClose();
                    }}
                  >
                    Load Ocean Scenario →
                  </button>

                </div>

              </div>

            </div>

          )}

          {activeTab === 'steps' && (
            <div className="demo-tab-content">
              <div className="demo-steps-list">
                <div className="demo-step-item">
                  <span className="step-num">1</span>

                  <div>
                    <h4>Fast O(1) Search & Read Model</h4>

                    <p>Search shipment ID to show instantaneous read model retrieval (&lt;10ms SLA).</p>

                  </div>

                </div>

                <div className="demo-step-item">
                  <span className="step-num">2</span>

                  <div>
                    <h4>Time-Travel Scrubbing (Genesis to Anomaly)</h4>

                    <p>Drag the time slider back to Version 1 (Genesis), then step to Version 3 to reveal the thermal spike.</p>

                  </div>

                </div>

                <div className="demo-step-item">
                  <span className="step-num">3</span>

                  <div>
                    <h4>Telemetry Anomaly Correlation</h4>

                    <p>Hover on the Recharts graph spike to highlight the exact domain event card with a glowing badge.</p>

                  </div>

                </div>

                <div className="demo-step-item">
                  <span className="step-num">4</span>

                  <div>
                    <h4>Optimistic Concurrency Control (OCC 409)</h4>

                    <p>Submit a command from a stale version to prove HTTP 409 conflict detection and 1-click state refresh recovery.</p>

                  </div>

                </div>

              </div>

            </div>

          )}

          {activeTab === 'viva_qa' && (
            <div className="demo-tab-content">
              <div className="viva-qa-list">
                <div className="viva-qa-item">
                  <h4>Q: Why Event Sourcing over traditional CRUD?</h4>

                  <p>A: In CRUD, updates overwrite previous data, destroying historical truth. In Event Sourcing, every change is an immutable event, providing mathematical auditability and temporal state travel.</p>

                </div>

                <div className="viva-qa-item">
                  <h4>Q: How does CQRS achieve high performance?</h4>

                  <p>A: Writes (commands) write to an immutable Event Store with OCC validation. An asynchronous projection worker materializes read models for sub-millisecond O(1) queries.</p>

                </div>

                <div className="viva-qa-item">
                  <h4>Q: What protects against concurrent overwrites?</h4>

                  <p>A: Optimistic Concurrency Control (OCC) requires an expectedVersion on each command. Discrepancies produce HTTP 409 Conflict responses with 1-click state refresh.</p>

                </div>

              </div>

            </div>

          )}
        </div>

        <div className="demo-modal-footer">
          <span className="demo-footer-info">Engineering Team: Aman Kumar (Lead Forensic Analyst) · Raushan Kumar (Chief Architect & Tech Lead) · Yash Kamble (Lead Domain Architect)</span>

          <button type="button" className="demo-btn-close" onClick={onClose}>
            Close Guide
          </button>

        </div>

      </div>

    </div>

  );
}
