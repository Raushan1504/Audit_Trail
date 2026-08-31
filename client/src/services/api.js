const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function handleResponse(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function getShipmentState(shipmentId) {
  const response = await fetch(`${BASE_URL}/queries/shipments/${shipmentId}`);
  return handleResponse(response);
}

export async function getShipmentEvents(shipmentId) {
  const response = await fetch(`${BASE_URL}/queries/shipment/${shipmentId}/events`);
  return handleResponse(response);
}