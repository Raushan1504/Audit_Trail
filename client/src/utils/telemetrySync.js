/**
 * Day 25: Telemetry & Event Timeline Synchronization Utilities
 * Person 3 (React): Aman Kumar <ak1276054@gmail.com>
 *
 * Provides helper functions for synchronizing Recharts data points, hover tooltips,
 * and chronological event timeline cards during cold-chain forensic investigations.
 */

/**
 * Finds the corresponding event in the event history for a given version or data point.
 * @param {Array} events - List of shipment domain events
 * @param {number|Object} target - Target version number or telemetry data point
 * @returns {Object|null} Matching domain event or null
 */
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

/**
 * Checks whether an event and telemetry point represent a correlated anomaly.
 * @param {Object} event - Domain event
 * @param {Object} telemetryPoint - Telemetry data point from Recharts
 * @returns {boolean} True if correlated anomaly
 */
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

/**
 * Generates badge label and styling metadata for synchronized telemetry points.
 * @param {Object} point - Telemetry data point
 * @returns {Object} Badge display metadata
 */
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
