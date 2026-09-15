import { Link } from 'react-router-dom';
import ThemeSelector from './ThemeSelector';
import './Navbar.css';

function Navbar() {
  return (
    <nav className="top-navbar">
      <div className="top-navbar__inner">
        <Link to="/" className="top-navbar__brand">
          <span className="brand-icon">📦</span>
          <span className="brand-text">
            AUDIT<span className="brand-accent">TRAIL</span>
          </span>
          <span className="brand-badge">v1.0 · Day 14</span>
        </Link>

        <div className="top-navbar__actions">
          <div className="navbar-status-indicator" title="MongoDB Event Store: Write-Once / Read-Many">
            <span className="status-dot" />
            <span className="status-text">Append-Only Active</span>
          </div>

          <ThemeSelector />
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
