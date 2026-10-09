import {
  getOfflineEvents,
  getOfflineState,
  getOfflineStateAsOf,
  getOfflineTelemetry,
  applyOfflineCommand
} from '../utils/offlineDataEngine';

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.origin.includes('vercel.app')
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api');

const REQUEST_TIMEOUT_MS = 1500;
let circuitTrippedUntil = 0;

function isCircuitTripped() {
  return Date.now() < circuitTrippedUntil;
}

function tripCircuit() {
  circuitTrippedUntil = Date.now() + 30000;
}

function resetCircuit() {
  circuitTrippedUntil = 0;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

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

export async function getShipmentState(shipmentId) {
  const normId = String(shipmentId || '').trim().toUpperCase();
  if (!normId) throw new Error('Shipment ID is required');

  if (!isCircuitTripped()) {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/queries/shipments/${encodeURIComponent(normId)}`);
      const data = await handleResponse(response);
      if (data && data.status) {
        resetCircuit();
        return data;
      }
    } catch (err) {
      tripCircuit();
      console.info(`[AuditTrail] Remote backend unreachable (${err.message}). Using resilient local ledger for ${normId}.`);
    }
  }

  const fallback = getOfflineState(normId);
  if (fallback) return fallback;
  throw new Error(`Shipment state for ${normId} could not be resolved.`);
}

export async function getShipmentEvents(shipmentId) {
  const normId = String(shipmentId || '').trim().toUpperCase();
  if (!normId) return [];

  if (!isCircuitTripped()) {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/queries/shipments/${encodeURIComponent(normId)}/events`);
      const data = await handleResponse(response);
      const events = Array.isArray(data) ? data : (data && Array.isArray(data.events) ? data.events : null);
      if (events && events.length > 0) {
        resetCircuit();
        return events;
      }
    } catch (err) {
      tripCircuit();
      console.info(`[AuditTrail] Remote backend unreachable (${err.message}). Using resilient local events for ${normId}.`);
    }
  }

  const fallback = getOfflineEvents(normId);
  if (fallback && fallback.length > 0) return fallback;
  return [];
}

export async function getShipmentStateAsOf(shipmentId, target) {
  const normId = String(shipmentId || '').trim().toUpperCase();
  if (!normId) throw new Error('Shipment ID is required');

  if (!isCircuitTripped()) {
    try {
      const response = await fetchWithTimeout(
        `${BASE_URL}/queries/shipments/${encodeURIComponent(normId)}/as-of/${encodeURIComponent(target)}`
      );
      const data = await handleResponse(response);
      if (data && data.status) {
        resetCircuit();
        return data;
      }
    } catch (err) {
      tripCircuit();
      console.info(`[AuditTrail] Remote backend unreachable (${err.message}). Using local state-as-of for ${normId}.`);
    }
  }

  const fallback = getOfflineStateAsOf(normId, target);
  if (fallback) return fallback;
  throw new Error(`Shipment state-as-of for ${normId} could not be resolved.`);
}

export async function getShipmentTelemetry(shipmentId) {
  const normId = String(shipmentId || '').trim().toUpperCase();
  if (!normId) throw new Error('Shipment ID is required');

  if (!isCircuitTripped()) {
    try {
      const response = await fetchWithTimeout(
        `${BASE_URL}/queries/shipments/${encodeURIComponent(normId)}/telemetry`
      );
      const data = await handleResponse(response);
      if (data && Array.isArray(data.timeSeries) && data.timeSeries.length > 0) {
        resetCircuit();
        return data;
      }
    } catch (err) {
      tripCircuit();
      console.info(`[AuditTrail] Remote backend unreachable (${err.message}). Using local telemetry for ${normId}.`);
    }
  }

  const fallback = getOfflineTelemetry(normId);
  if (fallback) return fallback;
  throw new Error(`Telemetry for ${normId} could not be resolved.`);
}

async function sendCommand(endpoint, payload) {
  if (!isCircuitTripped()) {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await handleResponse(response);
      resetCircuit();
      return data;
    } catch (err) {
      if (err.status === 409) {
        throw err;
      }
      tripCircuit();
      console.info(`[AuditTrail] Remote backend unreachable (${err.message}). Applying command to local ledger.`);
    }
  }
  return applyOfflineCommand(endpoint, payload);
}

export async function createShipmentCommand(payload) {
  return sendCommand('/commands/shipments/create', {
    ...payload,
    expectedVersion: payload.expectedVersion ?? 0
  });
}

export async function loadShipmentCommand(shipmentId, payload) {
  return sendCommand(`/commands/shipments/${encodeURIComponent(shipmentId)}/load`, payload);
}

export async function recordTemperatureSpikeCommand(shipmentId, payload) {
  return sendCommand(`/commands/shipments/${encodeURIComponent(shipmentId)}/temperature-spike`, payload);
}

export async function arriveAtPortCommand(shipmentId, payload) {
  return sendCommand(`/commands/shipments/${encodeURIComponent(shipmentId)}/arrive`, payload);
}