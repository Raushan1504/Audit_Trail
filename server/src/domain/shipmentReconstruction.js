const { replayShipmentEvents } = require('./shipmentReducer');

function reconstructShipmentState(shipmentId, events) {
  if (!shipmentId) {
    throw new Error('shipmentId is required');
  }

  if (!Array.isArray(events)) {
    throw new Error('events must be an array');
  }

  return replayShipmentEvents(shipmentId, events);
}

module.exports = {
  reconstructShipmentState
};
