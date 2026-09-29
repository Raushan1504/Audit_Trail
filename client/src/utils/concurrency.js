/**
 * Optimistic Concurrency Control (OCC) Utilities (Day 22)
 *
 * Provides functions for tracking aggregate versions in React form state,
 * validating expectedVersion guards, and building immutable command payloads.
 */

export const OCC_COMMAND_TYPES = Object.freeze({
  CREATE_CONTAINER: 'CREATE_CONTAINER',
  LOAD_ON_SHIP: 'LOAD_ON_SHIP',
  RECORD_TEMPERATURE_SPIKE: 'RECORD_TEMPERATURE_SPIKE',
  ARRIVE_AT_PORT: 'ARRIVE_AT_PORT'
});

/**
 * Returns allowed command types for a given shipment status.
 *
 * @param {string} status - Current shipment aggregate status
 * @returns {Array<string>} Allowed command type identifiers
 */
export function getAllowedCommandsForStatus(status) {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'CREATED':
      return [OCC_COMMAND_TYPES.LOAD_ON_SHIP];
    case 'LOADED':
    case 'ALERT':
    case 'TEMPERATURE_SPIKE':
      return [
        OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
        OCC_COMMAND_TYPES.ARRIVE_AT_PORT
      ];
    case 'ARRIVED':
      return [];
    default:
      return [];
  }
}

/**
 * Validates that expectedVersion is a valid non-negative integer.
 *
 * @param {*} expectedVersion
 * @returns {boolean}
 */
export function isValidExpectedVersion(expectedVersion) {
  if (expectedVersion === null || expectedVersion === undefined) return false;
  const num = Number(expectedVersion);
  return Number.isInteger(num) && num >= 0;
}

/**
 * Builds an OCC command payload ensuring expectedVersion is strictly forwarded.
 *
 * @param {string} commandType - One of OCC_COMMAND_TYPES
 * @param {string} shipmentId - The aggregate identity
 * @param {Object} formData - Form input values
 * @param {number} expectedVersion - The aggregate version captured during query fetch
 * @returns {Object} Complete command payload with expectedVersion guard
 */
export function buildOccCommandPayload(commandType, shipmentId, formData = {}, expectedVersion = 0) {
  if (!shipmentId || typeof shipmentId !== 'string') {
    throw new Error('Aggregate shipmentId is required for command execution');
  }

  if (!isValidExpectedVersion(expectedVersion)) {
    throw new Error(`Invalid OCC expectedVersion: ${expectedVersion}. Must be a non-negative integer.`);
  }

  const base = {
    shipmentId: shipmentId.trim().toUpperCase(),
    expectedVersion: Number(expectedVersion)
  };

  switch (commandType) {
    case OCC_COMMAND_TYPES.CREATE_CONTAINER:
      return {
        ...base,
        type: OCC_COMMAND_TYPES.CREATE_CONTAINER,
        origin: formData.origin?.trim() || '',
        destination: formData.destination?.trim() || '',
        cargo: formData.cargo?.trim() || '',
        expectedVersion: 0 // Genesis creation always expects version 0
      };

    case OCC_COMMAND_TYPES.LOAD_ON_SHIP:
      return {
        ...base,
        type: OCC_COMMAND_TYPES.LOAD_ON_SHIP,
        vessel: formData.vessel?.trim() || '',
        port: formData.port?.trim() || ''
      };

    case OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE:
      return {
        ...base,
        type: OCC_COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE,
        temperature: Number(formData.temperature),
        threshold: formData.threshold !== undefined ? Number(formData.threshold) : 4.0,
        sensorId: formData.sensorId?.trim() || 'SENSOR-IOT-01'
      };

    case OCC_COMMAND_TYPES.ARRIVE_AT_PORT:
      return {
        ...base,
        type: OCC_COMMAND_TYPES.ARRIVE_AT_PORT,
        port: formData.port?.trim() || ''
      };

    default:
      throw new Error(`Unsupported OCC command type: ${commandType}`);
  }
}
