/**
 * Day 25: Automated Anomaly Threshold Detection
 * Person 1 (Domain): Yash Kamble <yk3144779@gmail.com>
 *
 * Implements domain rules for evaluating cold-chain, environmental, and hardware telemetry
 * against strict cargo safety profiles (e.g. Frozen cargo <= -18°C, Pharma 2-8°C).
 */

const CARGO_PROFILES = Object.freeze({
  FROZEN: Object.freeze({
    type: 'FROZEN',
    maxTemperature: -18.0,
    minTemperature: -30.0,
    maxHumidity: 65.0,
    minBatteryVoltage: 3.4,
    description: 'Deep freeze cold-chain cargo (seafood, frozen meat, vaccines)'
  }),
  PHARMA: Object.freeze({
    type: 'PHARMA',
    maxTemperature: 8.0,
    minTemperature: 2.0,
    maxHumidity: 60.0,
    minBatteryVoltage: 3.5,
    description: 'Cold-chain pharmaceuticals, biologicals, insulin'
  }),
  PERISHABLE: Object.freeze({
    type: 'PERISHABLE',
    maxTemperature: 4.0,
    minTemperature: 0.0,
    maxHumidity: 85.0,
    minBatteryVoltage: 3.4,
    description: 'Fresh produce, dairy, chilled logistics'
  }),
  AMBIENT: Object.freeze({
    type: 'AMBIENT',
    maxTemperature: 25.0,
    minTemperature: 15.0,
    maxHumidity: 70.0,
    minBatteryVoltage: 3.3,
    description: 'General dry cargo, electronics, machinery'
  })
});

const DEFAULT_PROFILE = CARGO_PROFILES.PERISHABLE;

/**
 * Resolves cargo profile based on cargo description or explicit type.
 * @param {string|Object} cargo - Cargo name or profile indicator
 * @returns {Object} Cargo safety profile
 */
function resolveCargoProfile(cargo) {
  if (!cargo) return DEFAULT_PROFILE;

  const raw = typeof cargo === 'object' ? (cargo.type || cargo.description || '') : String(cargo);
  const normalized = raw.trim().toUpperCase();

  if (normalized.includes('FROZEN') || normalized.includes('ICE') || normalized.includes('SEAFOOD')) {
    return CARGO_PROFILES.FROZEN;
  }
  if (normalized.includes('PHARMA') || normalized.includes('VACCINE') || normalized.includes('INSULIN') || normalized.includes('BIOLOGICAL')) {
    return CARGO_PROFILES.PHARMA;
  }
  if (normalized.includes('ELECTRONIC') || normalized.includes('DRY') || normalized.includes('AMBIENT') || normalized.includes('HARDWARE')) {
    return CARGO_PROFILES.AMBIENT;
  }
  if (normalized.includes('PERISHABLE') || normalized.includes('DAIRY') || normalized.includes('FRUIT') || normalized.includes('CHILLED')) {
    return CARGO_PROFILES.PERISHABLE;
  }

  return DEFAULT_PROFILE;
}

/**
 * Evaluates whether an environmental sensor reading breaches safe thresholds.
 *
 * @param {Object} reading - Sensor telemetry payload
 * @param {string|Object} [cargoHint] - Optional cargo type description
 * @returns {Object} Anomaly evaluation result
 */
function evaluateThresholdBreach(reading = {}, cargoHint = null) {
  const profile = resolveCargoProfile(cargoHint);
  const temperature = reading.temperature !== undefined && reading.temperature !== null ? Number(reading.temperature) : null;
  const humidity = reading.humidity !== undefined && reading.humidity !== null ? Number(reading.humidity) : null;
  const batteryVoltage = reading.batteryVoltage !== undefined && reading.batteryVoltage !== null ? Number(reading.batteryVoltage) : null;
  const explicitThreshold = reading.threshold !== undefined && reading.threshold !== null ? Number(reading.threshold) : profile.maxTemperature;

  const breaches = [];
  let severity = 'NORMAL';

  // 1. Temperature Breach Check
  if (temperature !== null) {
    if (reading.threshold !== undefined && reading.threshold !== null && temperature > Number(reading.threshold)) {
      const explicit = Number(reading.threshold);
      const delta = Number((temperature - explicit).toFixed(2));
      severity = 'CRITICAL';
      breaches.push({
        type: 'TEMPERATURE_SPIKE',
        severity: 'CRITICAL',
        value: temperature,
        threshold: explicit,
        delta,
        message: `Temperature of ${temperature}°C exceeded critical threshold of ${explicit}°C (+${delta}°C breach)`
      });
    } else if (temperature > profile.maxTemperature) {
      const delta = Number((temperature - profile.maxTemperature).toFixed(2));
      severity = 'CRITICAL';
      breaches.push({
        type: 'CARGO_TEMP_EXCEEDED',
        severity: 'CRITICAL',
        value: temperature,
        threshold: profile.maxTemperature,
        delta,
        message: `Temperature of ${temperature}°C exceeds safe limit for ${profile.type} cargo (${profile.maxTemperature}°C)`
      });
    } else if (temperature < profile.minTemperature) {
      const delta = Number((profile.minTemperature - temperature).toFixed(2));
      severity = severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
      breaches.push({
        type: 'CARGO_SUBLIMIT_FREEZE',
        severity: 'WARNING',
        value: temperature,
        threshold: profile.minTemperature,
        delta,
        message: `Temperature of ${temperature}°C subcooled below minimum safe limit (${profile.minTemperature}°C)`
      });
    }
  }

  // 2. Humidity Breach Check
  if (humidity !== null && humidity > profile.maxHumidity) {
    const delta = Number((humidity - profile.maxHumidity).toFixed(1));
    severity = severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
    breaches.push({
      type: 'EXCESSIVE_HUMIDITY',
      severity: 'WARNING',
      value: humidity,
      threshold: profile.maxHumidity,
      delta,
      message: `Relative humidity of ${humidity}% RH exceeds safe maximum (${profile.maxHumidity}% RH)`
    });
  }

  // 3. Battery Reserve Depletion Check
  if (batteryVoltage !== null && batteryVoltage < profile.minBatteryVoltage) {
    const delta = Number((profile.minBatteryVoltage - batteryVoltage).toFixed(2));
    severity = severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
    breaches.push({
      type: 'LOW_BATTERY_RESERVE',
      severity: 'WARNING',
      value: batteryVoltage,
      threshold: profile.minBatteryVoltage,
      delta,
      message: `Sensor battery voltage at ${batteryVoltage}V is below operating floor (${profile.minBatteryVoltage}V)`
    });
  }

  const isAnomaly = breaches.length > 0;

  return {
    isAnomaly,
    severity: isAnomaly ? severity : 'NORMAL',
    profile: profile.type,
    breachesCount: breaches.length,
    breaches,
    summary: isAnomaly ? breaches.map((b) => b.message).join(' | ') : 'All telemetry parameters nominal'
  };
}

/**
 * Detects whether a domain event represents an anomaly according to automated domain rules.
 *
 * @param {Object} event - Domain event object
 * @param {string|Object} [cargoHint] - Optional cargo profile hint
 * @returns {Object} Enriched anomaly metadata for the event
 */
function detectEventAnomaly(event, cargoHint = null) {
  if (!event || typeof event !== 'object') {
    return { isAnomaly: false, severity: 'NORMAL', breaches: [] };
  }

  const payload = event.payload || {};
  const isSpikeType = event.eventType === 'TEMPERATURE_SPIKE';
  const evaluation = evaluateThresholdBreach(payload, cargoHint);

  if (isSpikeType && !evaluation.isAnomaly) {
    // If event explicitly is TEMPERATURE_SPIKE, enforce minimum CRITICAL anomaly classification
    return {
      isAnomaly: true,
      severity: 'CRITICAL',
      profile: evaluation.profile,
      breachesCount: 1,
      breaches: [{
        type: 'EXPLICIT_SPIKE_EVENT',
        severity: 'CRITICAL',
        value: payload.temperature ?? 10.0,
        threshold: payload.threshold ?? 4.0,
        delta: Number(((payload.temperature ?? 10.0) - (payload.threshold ?? 4.0)).toFixed(2)),
        message: 'Explicit TEMPERATURE_SPIKE domain event logged on ledger'
      }],
      summary: 'Explicit TEMPERATURE_SPIKE domain event logged on ledger'
    };
  }

  return evaluation;
}

module.exports = {
  CARGO_PROFILES,
  DEFAULT_PROFILE,
  resolveCargoProfile,
  evaluateThresholdBreach,
  detectEventAnomaly
};
