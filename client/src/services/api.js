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

const REQUEST_TIMEOUT_MS = 2500;

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
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/queries/shipments/${shipmentId}`);
    return await handleResponse(response);
  } catch (err) {
    console.info(`[AuditTrail] Remote backend unreachable (${err.message}). Using resilient local ledger for ${shipmentId}.`);
    const fallback = getOfflineState(shipmentId);
    if (fallback) return fallback;
    throw err;
  }
}

export async function getShipmentEvents(shipmentId) {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/queries/shipment/${shipmentId}/events`);
    return await handleResponse(response);
  } catch (err) {
    console.info(`[AuditTrail] Remote backend unreachable (${err.message}). Using resilient local events for ${shipmentId}.`);
    const fallback = getOfflineEvents(shipmentId);
    if (fallback) return fallback;
    throw err;
  }
}

export async function getShipmentStateAsOf(shipmentId, target) {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/queries/shipments/${encodeURIComponent(shipmentId)}/as-of/${encodeURIComponent(target)}`
    );
    return await handleResponse(response);
  } catch (err) {
    console.info(`[AuditTrail] Remote backend unreachable (${err.message}). Using local state-as-of for ${shipmentId}.`);
    const fallback = getOfflineStateAsOf(shipmentId, target);
    if (fallback) return fallback;
    throw err;
  }
}

export async function getShipmentTelemetry(shipmentId) {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/queries/shipments/${encodeURIComponent(shipmentId)}/telemetry`
    );
    return await handleResponse(response);
  } catch (err) {
    console.info(`[AuditTrail] Remote backend unreachable (${err.message}). Using local telemetry for ${shipmentId}.`);
    const fallback = getOfflineTelemetry(shipmentId);
    if (fallback) return fallback;
    throw err;
  }
}

async function sendCommand(endpoint, payload) {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return await handleResponse(response);
  } catch (err) {
    // If it's a genuine 409 conflict from backend, re-throw so UI modal catches it
    if (err.status === 409) {
      throw err;
    }
    console.info(`[AuditTrail] Remote backend unreachable (${err.message}). Applying command to local ledger.`);
    return applyOfflineCommand(endpoint, payload);
  }
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