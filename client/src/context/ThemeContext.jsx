import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEMES = [
  { id: 'cyber', name: 'Cyber Neon', color: '#00f0ff', bg: '#080c14' },
  { id: 'black', name: 'Obsidian Black', color: '#ffffff', bg: '#000000' },
  { id: 'enterprise', name: 'Enterprise Slate', color: '#3b82f6', bg: '#0b1120' },
  { id: 'emerald', name: 'Emerald Ledger', color: '#10b981', bg: '#06110d' },
  { id: 'amber', name: 'Amber Cargo', color: '#f59e0b', bg: '#14100c' },
  { id: 'light', name: 'Daylight Clean', color: '#0284c7', bg: '#f8fafc' },
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('audit_trail_theme') || 'cyber';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('audit_trail_theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
