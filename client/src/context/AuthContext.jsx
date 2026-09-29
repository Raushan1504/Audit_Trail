import React, { createContext, useContext, useState } from 'react';
import { DEMO_OPERATORS, createSessionToken } from '../utils/authProfiles.js';

export { DEMO_OPERATORS } from '../utils/authProfiles.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('audit_trail_operator');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback if localStorage is inaccessible
    }
    // Default operator session for seamless demo experience
    return DEMO_OPERATORS[0];
  });

  const login = (credentials) => {
    const matchedPreset = DEMO_OPERATORS.find(
      (op) => op.email.toLowerCase() === (credentials.email || '').trim().toLowerCase()
    );

    const operatorSession = {
      id: matchedPreset?.id || `op_${Date.now()}`,
      name: credentials.name || matchedPreset?.name || 'Forensic Operator',
      email: credentials.email || matchedPreset?.email || 'operator@audittrail.io',
      role: credentials.role || matchedPreset?.role || 'Forensic Analyst',
      badge: matchedPreset?.badge || 'Maritime Auditor',
      avatar: matchedPreset?.avatar || '👤',
      sessionToken: createSessionToken(matchedPreset?.id || 'op_custom'),
      loggedInAt: new Date().toISOString()
    };

    try {
      localStorage.setItem('audit_trail_operator', JSON.stringify(operatorSession));
    } catch (e) {
      console.warn('Could not persist operator session to localStorage:', e);
    }

    setUser(operatorSession);
    return operatorSession;
  };

  const logout = () => {
    try {
      localStorage.removeItem('audit_trail_operator');
    } catch (e) {
      console.warn('Could not remove operator session from localStorage:', e);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        demoOperators: DEMO_OPERATORS
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
