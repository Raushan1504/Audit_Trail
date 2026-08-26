const COMMAND_TYPES = Object.freeze({
  CREATE_CONTAINER: 'CREATE_CONTAINER',
  LOAD_ON_SHIP: 'LOAD_ON_SHIP',
  RECORD_TEMPERATURE_SPIKE: 'RECORD_TEMPERATURE_SPIKE',
  ARRIVE_AT_PORT: 'ARRIVE_AT_PORT'
});

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

  return true;
}

function validateStateTransition(currentStatus, commandType) {
  const allowedTransitions = {
    CREATED: [COMMAND_TYPES.LOAD_ON_SHIP],
    LOADED: [COMMAND_TYPES.RECORD_TEMPERATURE_SPIKE],
    TEMPERATURE_SPIKE: [COMMAND_TYPES.ARRIVE_AT_PORT],
    ARRIVED: []
  };

  const allowedCommands = allowedTransitions[currentStatus];

  if (!allowedCommands) {
    throw new Error(`Unknown shipment status: ${currentStatus}`);
  }

  if (!allowedCommands.includes(commandType)) {
    throw new Error(
      `Invalid command ${commandType} for shipment status ${currentStatus}`
    );
  }

  return true;
}

module.exports = {
  COMMAND_TYPES,
  validateCommand,
  validateStateTransition
};