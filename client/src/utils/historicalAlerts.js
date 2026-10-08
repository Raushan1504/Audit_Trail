
export function getHistoricalAlertMeta(currentVersion, totalVersions, activeEvent = null) {
  const current = Number(currentVersion) || 1;
  const total = Number(totalVersions) || 1;
  const versionsBehind = Math.max(0, total - current);
  const isAtHead = versionsBehind === 0;

  let severity = 'warning';
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

export function shouldShowHistoricalWatermark(currentStep, totalEvents, isHistoricalMode = false) {
  if (isHistoricalMode) return true;
  if (currentStep !== null && totalEvents > 0 && currentStep < totalEvents) {
    return true;
  }
  return false;
}
