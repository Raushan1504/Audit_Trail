
export const BREAKPOINTS = Object.freeze({
  MOBILE: 640,
  TABLET: 1024,
  DESKTOP: 1280
});

export function isMobileScreen(width) {
  if (typeof width !== 'number' || isNaN(width)) return false;
  return width < BREAKPOINTS.MOBILE;
}

export function isTabletScreen(width) {
  if (typeof width !== 'number' || isNaN(width)) return false;
  return width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.TABLET;
}

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

export function buildScreenReaderAnnouncement(version, eventType, isAnomaly = false) {
  const typeLabel = (eventType || 'STATE UPDATE').replace(/_/g, ' ');
  if (isAnomaly) {
    return `Critical Alert! Reconstructed version ${version}: ${typeLabel} thermal anomaly detected.`;
  }
  return `Timeline navigated to version ${version}: ${typeLabel}.`;
}
