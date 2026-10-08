import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, DEMO_OPERATORS } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [email, setEmail] = useState('aman@audittrail.io');
  const [passcode, setPasscode] = useState('audit2026');
  const [role, setRole] = useState('Lead Forensic Analyst');
  const [useHardwareKey, setUseHardwareKey] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  const handleSelectPreset = (operator) => {
    setEmail(operator.email);
    setPasscode(operator.passcode);
    setRole(operator.role);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide a valid operator email or ID.');
      return;
    }
    if (!passcode.trim()) {
      setError('Security passcode or cryptographic key cannot be empty.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      const selectedOp = DEMO_OPERATORS.find(
        (op) => op.email.toLowerCase() === email.trim().toLowerCase()
      );

      login({
        name: selectedOp?.name || email.split('@')[0],
        email: email.trim(),
        role: role || selectedOp?.role || 'Forensic Analyst'
      });

      setIsSubmitting(false);
      setAuthSuccess(true);

      setTimeout(() => {
        navigate('/dashboard');
      }, 700);
    }, 600);
  };

  return (
    <div className="login-container">

      <div className="login-glow login-glow--primary" />
      <div className="login-glow login-glow--accent" />

      <div className="login-card">

        <div className="login-card__header">
          <div className="login-badge">
            <span className="login-badge-dot" />
            <span>ENTERPRISE FORENSIC TERMINAL</span>

          </div>

          <h1 className="login-title">
            OPERATOR <span className="login-title-accent">AUTHENTICATION</span>

          </h1>

          <p className="login-subtitle">
            Sign in to access immutable event streams, historical time-travel scrubber, and maritime AIS radar.
          </p>

        </div>

        <div className="login-presets">
          <span className="login-presets__label">⚡ ONE-CLICK DEMO OPERATORS</span>

          <div className="login-presets__grid">
            {DEMO_OPERATORS.map((op) => (
              <button
                key={op.id}
                type="button"
                className={`login-preset-btn ${email === op.email ? 'login-preset-btn--active' : ''}`}
                onClick={() => handleSelectPreset(op)}
              >
                <span className="preset-avatar">{op.avatar}</span>

                <div className="preset-info">
                  <span className="preset-name">{op.name}</span>

                  <span className="preset-role">{op.role}</span>

                </div>

              </button>

            ))}
          </div>

        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-alert login-alert--error" role="alert">
              <span className="alert-icon">⚠</span>

              <span>{error}</span>

            </div>

          )}

          {authSuccess && (
            <div className="login-alert login-alert--success" role="status">
              <span className="alert-icon">✓</span>

              <span>Identity verified. Initializing cryptographic audit session...</span>

            </div>

          )}

          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              OPERATOR IDENTITY / EMAIL
            </label>

            <div className="input-wrapper">
              <span className="input-icon">👤</span>

              <input
                id="login-email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@audittrail.io"
                required
              />
            </div>

          </div>

          <div className="form-group">
            <label htmlFor="login-passcode" className="form-label">
              CRYPTOGRAPHIC KEY / PASSCODE
            </label>

            <div className="input-wrapper">
              <span className="input-icon">🔑</span>

              <input
                id="login-passcode"
                type="password"
                className="form-input"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode..."
                required
              />
            </div>

          </div>

          <div className="form-group">
            <label htmlFor="login-role" className="form-label">
              ASSIGNED AUDITOR ROLE
            </label>

            <div className="input-wrapper">
              <span className="input-icon">🛡️</span>

              <select
                id="login-role"
                className="form-input form-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Lead Forensic Analyst">Lead Forensic Analyst (Person 3)</option>

                <option value="Chief Auditor & Architect">Chief Auditor & Architect (Team Lead)</option>

                <option value="Maritime Compliance Inspector">Maritime Compliance Inspector (IMO)</option>

                <option value="Cold Chain Specialist">Cold Chain Specialist</option>

              </select>

            </div>

          </div>

          <div className="form-checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useHardwareKey}
                onChange={(e) => setUseHardwareKey(e.target.checked)}
                className="checkbox-input"
              />
              <span className="checkbox-custom" />
              <span className="checkbox-text">
                Enforce FIDO2 / Hardware Security Token & Append-Only Log Signatures
              </span>

            </label>

          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isSubmitting || authSuccess}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-dots" />
                <span>Verifying Cryptographic Handshake...</span>

              </>

            ) : authSuccess ? (
              <>
                <span>✓ Authorized · Redirecting...</span>

              </>

            ) : (
              <>
                <span>🔐 Authenticate & Launch Console</span>

                <span className="btn-arrow">→</span>

              </>

            )}
          </button>

        </form>

        <div className="login-card__footer">
          <Link to="/" className="back-link">
            ← Return to Landing Page
          </Link>

          <span className="security-notice">
            🔒 Append-Only Zero Trust Session · Monotonic Versioning
          </span>

        </div>

      </div>

    </div>

  );
}
