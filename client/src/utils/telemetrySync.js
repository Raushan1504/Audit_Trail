
export function findEventByVersion(events, target) {
  if (!Array.isArray(events) || events.length === 0 || target === null || target === undefined) {
    return null;
  }

  const targetVersion = typeof target === 'object' ? target.version : Number(target);
  if (isNaN(targetVersion)) return null;

  return events.find((e, idx) => {
    const eventVer = e.version !== undefined ? e.version : idx + 1;
    return eventVer === targetVersion;
  }) || null;
}

export function isCorrelatedAnomaly(event, telemetryPoint) {
  if (!event && !telemetryPoint) return false;

  const isSpikeEvent = event?.eventType === 'TEMPERATURE_SPIKE';
  const isPointAnomaly = Boolean(telemetryPoint?.isAnomaly);
  const isTempBreach =
    telemetryPoint?.temperature !== undefined &&
    telemetryPoint?.threshold !== undefined &&
    telemetryPoint.temperature > telemetryPoint.threshold;

  return isSpikeEvent || isPointAnomaly || isTempBreach;
}

export function getTelemetrySyncBadgeMeta(point) {
  if (!point) {
    return { label: 'SYNCHRONIZED', isAnomaly: false, variant: 'neutral' };
  }

  if (point.isAnomaly || point.eventType === 'TEMPERATURE_SPIKE') {
    return {
      label: `🔥 THERMAL SPIKE (+${(point.temperature - point.threshold).toFixed(1)}°C)`,
      isAnomaly: true,
      variant: 'critical'
    };
  }

  if (point.humidity !== undefined && point.humidity > 80) {
    return {
      label: `💧 HIGH HUMIDITY (${point.humidity}%)`,
      isAnomaly: true,
      variant: 'warning'
    };
  }

  return {
    label: `📡 TELEMETRY v${point.version}`,
    isAnomaly: false,
    variant: 'synced'
  };
}
