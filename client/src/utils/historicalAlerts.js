/**
 * Historical Inspection Alert & High-Contrast Banner Utilities (Day 21)
 *
 * Provides deterministic calculation of historical alert levels, operator warning copy,
 * past-value card badges, and version lag metrics to prevent operators from mistaking
 * past states for live operational data.
 */

/**
 * Calculates historical alert metadata for the top warning banner and operator HUD.
 *
 * @param {number} currentVersion - The currently scrubbed event sequence number
 * @param {number} totalVersions - The latest confirmed ledger sequence height
 * @param {Object} [activeEvent] - The domain event corresponding to currentVersion
 * @returns {Object} Alert metadata object
 */
export function getHistoricalAlertMeta(currentVersion, totalVersions, activeEvent = null) {
  const current = Number(currentVersion) || 1;
  const total = Number(totalVersions) || 1;
  const versionsBehind = Math.max(0, total - current);
  const isAtHead = versionsBehind === 0;

  let severity = 'warning'; // 'warning' | 'critical' | 'info'
  if (versionsBehind > 2 || activeEvent?.eventType === 'TEMPERATURE_SPIKE') {
    severity = 'critical';
  } else if (isAtHead) {
    severity = 'info';
  }

  const headline = 'HISTORICAL INSPECTION ACTIVE — NOT LIVE OPERATIONAL DATA';

  const lagDescription = isAtHead
    ? 'State is at confirmed ledger head, but historical inspection mode is active.'
    : `${versionsBehind} ${versionsBehind === 1 ? 'version' : 'versions'} behind confirmed live head.`;

  const operatorGuidance =
    'Telemetry, geolocation, and environmental sensors reflect past recorded events. Do not use for live logistics routing or emergency response.';

  const fullNotice = `Viewing point-in-time state at Version ${current} of ${total} (${lagDescription}) ${operatorGuidance}`;

  return {
    isHistorical: true,
    isAtHead,
    currentVersion: current,
    totalVersions: total,
    versionsBehind,
    severity,
    headline,
    lagDescription,
    operatorGuidance,
    fullNotice,
    eventSummary: activeEvent
      ? `${activeEvent.eventType} (#${activeEvent.version})`
      : `Version ${current}`,
    timestamp: activeEvent?.timestamp ? new Date(activeEvent.timestamp) : null
  };
}

/**
 * Resolves high-contrast past value badge attributes for individual telemetry cards.
 *
 * @param {string} field - The card category ('status' | 'location' | 'version' | 'temperature')
 * @param {*} value - The historical value
 * @param {boolean} isHistorical - Whether historical mode is active
 * @param {Object} [options] - Additional context like isAnomaly or version
 * @returns {Object} Badge definition { showBadge, badgeText, badgeClass, isAnomaly }
 */
export function getPastValueBadge(field, value, isHistorical = false, options = {}) {
  if (!isHistorical) {
    return {
      showBadge: false,
      badgeText: '',
      badgeClass: '',
      isAnomaly: false
    };
  }

  const version = options.version !== undefined ? `v${options.version}` : '';

  switch (field) {
    case 'status':
      return {
        showBadge: true,
        badgeText: `PAST STATUS · ${version || 'HISTORICAL'}`,
        badgeClass: 'past-badge--status',
        isAnomaly: false
      };

    case 'location':
      return {
        showBadge: true,
        badgeText: `HISTORICAL AIS / PORT · ${version || 'RECORDED'}`,
        badgeClass: 'past-badge--location',
        isAnomaly: false
      };

    case 'version':
      return {
        showBadge: true,
        badgeText: `REWOUND SEQUENCE · ${version || 'SNAPSHOT'}`,
        badgeClass: 'past-badge--version',
        isAnomaly: false
      };

    case 'temperature': {
      const isHigh = options.isHighTemp || (typeof value === 'number' && value > 8);
      if (isHigh) {
        return {
          showBadge: true,
          badgeText: 'HISTORICAL SPIKE · NOT ACTIVE ALARM',
          badgeClass: 'past-badge--spike-warning',
          isAnomaly: true
        };
      }
      return {
        showBadge: true,
        badgeText: `PAST SENSOR LOG · ${version || 'RECORDED'}`,
        badgeClass: 'past-badge--temp-nominal',
        isAnomaly: false
      };
    }

    default:
      return {
        showBadge: true,
        badgeText: `PAST RECORD · ${version}`,
        badgeClass: 'past-badge--generic',
        isAnomaly: false
      };
  }
}

/**
 * Determines whether the maritime AIS map should display the historical watermark.
 *
 * @param {number} currentStep - The current scrubbed version
 * @param {number} totalEvents - Total events in stream
 * @param {boolean} isHistoricalMode - True if historical view mode is active
 * @returns {boolean} True if historical watermark should be rendered
 */
export function shouldShowHistoricalWatermark(currentStep, totalEvents, isHistoricalMode = false) {
  if (isHistoricalMode) return true;
  if (currentStep !== null && totalEvents > 0 && currentStep < totalEvents) {
    return true;
  }
  return false;
}
