/**
 * Day 26: Responsive Layout & Accessibility (A11y) Utilities
 * Person 3 (React): Aman Kumar <ak1276054@gmail.com>
 *
 * Provides standardized ARIA announcements, responsive breakpoint checks,
 * and keyboard shortcut bindings for cold-chain forensic investigation dashboards.
 */

export const BREAKPOINTS = Object.freeze({
  MOBILE: 640,
  TABLET: 1024,
  DESKTOP: 1280
});

/**
 * Checks if a viewport width qualifies as mobile screen size.
 * @param {number} width - Screen width in pixels
 * @returns {boolean}
 */
export function isMobileScreen(width) {
  if (typeof width !== 'number' || isNaN(width)) return false;
  return width < BREAKPOINTS.MOBILE;
}

/**
 * Checks if a viewport width qualifies as tablet screen size.
 * @param {number} width - Screen width in pixels
 * @returns {boolean}
 */
export function isTabletScreen(width) {
  if (typeof width !== 'number' || isNaN(width)) return false;
  return width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.TABLET;
}

/**
 * Computes next step based on keyboard directional navigation keys.
 * @param {string} key - e.g. 'ArrowRight', 'ArrowLeft', 'Home', 'End'
 * @param {number} currentStep - 1-based current step
 * @param {number} maxSteps - Total available steps
 * @returns {number|null} Next target step or null if unhandled key
 */
export function resolveKeyboardStepNavigation(key, currentStep, maxSteps) {
  if (!maxSteps || maxSteps <= 0) return null;
  const current = currentStep || 1;

  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(maxSteps, current + 1);
    case 'ArrowLeft':
    case 'ArrowUp':
      return Math.max(1, current - 1);
    case 'Home':
      return 1;
    case 'End':
      return maxSteps;
    default:
      return null;
  }
}

/**
 * Builds live screen-reader announcement copy for temporal state transitions.
 * @param {number} version - Reconstructed target version
 * @param {string} eventType - Canonical event name
 * @param {boolean} [isAnomaly] - Whether the event represents a critical breach
 * @returns {string} Accessible announcement string
 */
export function buildScreenReaderAnnouncement(version, eventType, isAnomaly = false) {
  const typeLabel = (eventType || 'STATE UPDATE').replace(/_/g, ' ');
  if (isAnomaly) {
    return `Critical Alert! Reconstructed version ${version}: ${typeLabel} thermal anomaly detected.`;
  }
  return `Timeline navigated to version ${version}: ${typeLabel}.`;
}
