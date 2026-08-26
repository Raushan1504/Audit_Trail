const COMMAND_TYPES = Object.freeze({
  CREATE_CONTAINER: 'CREATE_CONTAINER',
  LOAD_ON_SHIP: 'LOAD_ON_SHIP',
  RECORD_TEMPERATURE_SPIKE: 'RECORD_TEMPERATURE_SPIKE',
  ARRIVE_AT_PORT: 'ARRIVE_AT_PORT'
});
/**
 * Validates the structure and required payload fields of a command.
 * @param {Object} command - The command object to validate.
 */
function validateCommand(command) {
  if (!command || typeof command !== 'object') {
    throw new Error('command is required');
  }

  if (!command.shipmentId) {
    throw new Error('shipmentId is required');
  }

  if (!command.type) {
    throw new Error('command type is required');
  }

  if (!Object.values(COMMAND_TYPES).includes(command.type)) {
    throw new Error(`Unsupported command type: ${command.type}`);
  }
  if (command.type === COMMAND_TYPES.CREATE_CONTAINER) {
    if (!command.origin) throw new Error('origin is required');
    if (!command.destination) throw new Error('destination is required');
  } else if (command.type === COMMAND_TYPES.LOAD_ON_SHIP) {
    if (!command.vessel) throw new Error('vessel is required');
    if (!command.port) throw new Error('port is required');
  } else if (command.type === COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE) {
    if (command.temperature === undefined) throw new Error('temperature is required');
    if (command.threshold === undefined) throw new Error('threshold is required');
  } else if (command.type === COMMAND_TYPES.ARRIVE_AT_PORT) {
    if (!command.port) throw new Error('port is required');
  }

  return true;
}
function validateStateTransition(currentState, commandType) {
  const status = currentState?.status;
  const version = currentState?.version || 0;
  if (version === 0) {
    if (commandType !== COMMAND_TYPES.CREATE_CONTAINER) {
      throw new Error(`Shipment must be created first before executing command: ${commandType}`);
    }
    return true;
  }
  if (commandType === COMMAND_TYPES.CREATE_CONTAINER) {
    throw new Error(`Shipment is already created (current status: ${status}, version: ${version})`);
  }
  const allowedTransitions = {
    CREATED: [COMMAND_TYPES.LOAD_ON_SHIP],
    LOADED: [COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE, COMMAND_TYPES.ARRIVE_AT_PORT],
    TEMPERATURE_SPIKE: [COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE, COMMAND_TYPES.ARRIVE_AT_PORT],
    ARRIVED: []
  };

  const allowedCommands = allowedTransitions[status];

  if (!allowedCommands) {
    throw new Error(`Unknown shipment status: ${status}`);
  }
  if (!allowedCommands.includes(commandType)) {
    throw new Error(
      `Invalid command ${commandType} for shipment status ${status}`
    );
  }

  return true;
}

module.exports = {
  COMMAND_TYPES,
  validateCommand,
  validateStateTransition
};