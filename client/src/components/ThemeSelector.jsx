import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import './ThemeSelector.css';

function ThemeSelector() {
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeTheme = themes.find((t) => t.id === theme) || themes[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="theme-selector" ref={dropdownRef}>
      <button
        type="button"
        className="theme-selector__trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Change dashboard design and color theme"
        aria-label="Theme Selector"
      >
        <span
          className="theme-dot"
          style={{ backgroundColor: activeTheme.color, boxShadow: `0 0 8px ${activeTheme.color}` }}
        />
        <span className="theme-name">{activeTheme.name}</span>
        <span className="theme-caret">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="theme-selector__menu">
          <div className="theme-menu__header">
            <span>DASHBOARD THEMES</span>
          </div>
          {themes.map((t) => {
            const isCurrent = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                className={`theme-option ${isCurrent ? 'theme-option--active' : ''}`}
                onClick={() => {
                  setTheme(t.id);
                  setIsOpen(false);
                }}
              >
                <span
                  className="theme-option__dot"
                  style={{ backgroundColor: t.color, boxShadow: isCurrent ? `0 0 10px ${t.color}` : 'none' }}
                />
                <span className="theme-option__label">{t.name}</span>
                {isCurrent && <span className="theme-option__check">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ThemeSelector;
