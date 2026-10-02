const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function handleResponse(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.error || errorBody.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = errorBody;
    throw error;
  }
  const json = await response.json();
  return json.data !== undefined ? json.data : json;
}

// --- Query Functions (CQRS Read Side) ---

export async function getShipmentState(shipmentId) {
  const response = await fetch(`${BASE_URL}/queries/shipments/${shipmentId}`);
  return handleResponse(response);
}

export async function getShipmentEvents(shipmentId) {
  const response = await fetch(`${BASE_URL}/queries/shipment/${shipmentId}/events`);
  return handleResponse(response);
}

export async function getShipmentStateAsOf(shipmentId, target) {
  const response = await fetch(`${BASE_URL}/queries/shipments/${encodeURIComponent(shipmentId)}/as-of/${encodeURIComponent(target)}`);
  return handleResponse(response);
}

export async function getShipmentTelemetry(shipmentId) {
  const response = await fetch(`${BASE_URL}/queries/shipments/${encodeURIComponent(shipmentId)}/telemetry`);
  return handleResponse(response);
}

// --- Command Functions (CQRS Write Side with OCC expectedVersion) ---

async function sendCommand(endpoint, payload) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
}

/**
 * Dispatches CreateShipment command (Genesis Inception).
 * Always expects version 0 for uncreated aggregates.
 */
export async function createShipmentCommand(payload) {
  return sendCommand('/commands/shipments/create', {
    ...payload,
    expectedVersion: payload.expectedVersion ?? 0
  });
}

/**
 * Dispatches LoadShipment command with tracked aggregate expectedVersion.
 */
export async function loadShipmentCommand(shipmentId, payload) {
  return sendCommand(`/commands/shipments/${encodeURIComponent(shipmentId)}/load`, payload);
}

/**
 * Dispatches RecordTemperatureSpike command with tracked aggregate expectedVersion.
 */
export async function recordTemperatureSpikeCommand(shipmentId, payload) {
  return sendCommand(`/commands/shipments/${encodeURIComponent(shipmentId)}/temperature-spike`, payload);
}

/**
 * Dispatches ArriveAtPort command with tracked aggregate expectedVersion.
 */
export async function arriveAtPortCommand(shipmentId, payload) {
  return sendCommand(`/commands/shipments/${encodeURIComponent(shipmentId)}/arrive`, payload);
}