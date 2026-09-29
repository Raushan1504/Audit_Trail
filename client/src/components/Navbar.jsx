import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeSelector from './ThemeSelector';
import './Navbar.css';

function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const isHome = location.pathname === '/';
  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/shipment');
  const isLogin = location.pathname === '/login';

  return (
    <nav className="top-navbar">
      <div className="top-navbar__inner">
        {/* Brand / Logo */}
        <Link to="/" className="top-navbar__brand">
          <span className="brand-icon">📦</span>
          <span className="brand-text">
            AUDIT<span className="brand-accent">TRAIL</span>
          </span>
          <span className="brand-badge">v1.0 · Day 23</span>
        </Link>

        {/* Primary Navigation Links */}
        <div className="top-navbar__links">
          <Link
            to="/"
            className={`nav-link ${isHome ? 'nav-link--active' : ''}`}
          >
            <span className="nav-icon">🏠</span>
            <span>Home</span>
          </Link>
          <Link
            to="/dashboard"
            className={`nav-link ${isDashboard ? 'nav-link--active' : ''}`}
          >
            <span className="nav-icon">📊</span>
            <span>Forensic Console</span>
          </Link>
        </div>

        {/* Right Actions & Operator Status */}
        <div className="top-navbar__actions">
          <div className="navbar-status-indicator" title="MongoDB Event Store: Write-Once / Read-Many">
            <span className="status-dot" />
            <span className="status-text">Append-Only Active</span>
          </div>

          {/* Operator Profile / Login Button */}
          {user ? (
            <div className="operator-profile">
              <div
                className="operator-chip"
                title={`Signed in as ${user.name} (${user.role})`}
              >
                <span className="operator-avatar">{user.avatar || '👤'}</span>
                <div className="operator-meta">
                  <span className="operator-name">{user.name}</span>
                  <span className="operator-role">{user.role}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="btn-logout"
                title="Sign out operator session"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className={`btn-nav-login ${isLogin ? 'btn-nav-login--active' : ''}`}
            >
              🔐 Operator Login
            </Link>
          )}

          <ThemeSelector />
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
