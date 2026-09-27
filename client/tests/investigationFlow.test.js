import test from 'node:test';
import assert from 'node:assert/strict';

// Helper extracting UI error message logic from ShipmentDetails
function getErrorMessage(err) {
  if (!err) return 'Something went wrong.';
  if (err.status === 404) {
    return 'No shipment found with this ID. Double-check the ID and try again.';
  }
  if (err.status >= 500) {
    return 'The server ran into a problem. Please try again in a moment.';
  }
  if (err.message === 'Failed to fetch') {
    return 'Could not reach the server. Make sure the backend is running.';
  }
  return err.message || 'Something went wrong.';
}

// Search input sanitizer
function sanitizeShipmentQuery(input) {
  if (typeof input !== 'string') return '';
  return input.trim().toUpperCase();
}

// Event chronological validator
function validateEventSequence(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { valid: true, count: 0 };
  }

  for (let i = 0; i < events.length; i++) {
    const current = events[i];
    const expectedVersion = i + 1;

    if (current.version !== expectedVersion) {
      return {
        valid: false,
        error: `Sequence breach: expected version ${expectedVersion}, received ${current.version}`,
        atIndex: i
      };
    }
  }

  return { valid: true, count: events.length };
}

// UI State card model resolver
function resolveShipmentDisplayModel(data, events = []) {
  if (!data) return null;

  return {
    shipmentId: data.shipmentId || data.aggregateId || 'UNKNOWN',
    status: data.status || data.state || 'UNKNOWN',
    version: data.version ?? (events.length ? events[events.length - 1].version : 0),
    location: data.location || 'In Transit',
    temperature: data.temperature !== undefined ? `${data.temperature}°C` : null,
    eventCount: events.length,
    isReconstructed: true,
  };
}

test('Investigation Flow — Search Input Validation', async (t) => {
  await t.test('trims and normalizes shipment query string', () => {
    assert.strictEqual(sanitizeShipmentQuery('  ship-101  '), 'SHIP-101');
    assert.strictEqual(sanitizeShipmentQuery('cont-999'), 'CONT-999');
  });

  await t.test('handles empty or non-string input safely', () => {
    assert.strictEqual(sanitizeShipmentQuery(''), '');
    assert.strictEqual(sanitizeShipmentQuery(null), '');
    assert.strictEqual(sanitizeShipmentQuery(undefined), '');
    assert.strictEqual(sanitizeShipmentQuery(123), '');
  });
});

test('Investigation Flow — Error Message Resolution', async (t) => {
  await t.test('returns friendly 404 message for unknown shipment', () => {
    const err = { status: 404, message: 'Shipment not found' };
    const msg = getErrorMessage(err);
    assert.match(msg, /No shipment found with this ID/);
  });

  await t.test('returns 500 server error guidance', () => {
    const err = { status: 500, message: 'Internal error' };
    const msg = getErrorMessage(err);
    assert.match(msg, /server ran into a problem/);
  });

  await t.test('returns network connection guidance when backend is unreachable', () => {
    const err = { message: 'Failed to fetch' };
    const msg = getErrorMessage(err);
    assert.match(msg, /Could not reach the server/);
  });

  await t.test('falls back gracefully on empty or generic error', () => {
    assert.strictEqual(getErrorMessage(null), 'Something went wrong.');
    assert.strictEqual(getErrorMessage({ message: 'Custom error' }), 'Custom error');
  });
});

test('Investigation Flow — Event Sequence & Immutability Verification', async (t) => {
  await t.test('validates strictly ordered chronological event stream', () => {
    const events = [
      { aggregateId: 'SHIP-001', eventType: 'CONTAINER_CREATED', version: 1 },
      { aggregateId: 'SHIP-001', eventType: 'LOADED_ON_SHIP', version: 2 },
      { aggregateId: 'SHIP-001', eventType: 'TEMPERATURE_SPIKE', version: 3 },
      { aggregateId: 'SHIP-001', eventType: 'ARRIVED_AT_PORT', version: 4 },
    ];

    const result = validateEventSequence(events);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.count, 4);
  });

  await t.test('detects version gaps or out-of-order events', () => {
    const corruptedEvents = [
      { aggregateId: 'SHIP-001', eventType: 'CONTAINER_CREATED', version: 1 },
      { aggregateId: 'SHIP-001', eventType: 'LOADED_ON_SHIP', version: 3 }, // Skipped version 2
    ];

    const result = validateEventSequence(corruptedEvents);
    assert.strictEqual(result.valid, false);
    assert.match(result.error, /Sequence breach/);
  });
});

test('Investigation Flow — UI Display Model Construction', async (t) => {
  await t.test('maps replayed state into display model correctly', () => {
    const stateData = {
      shipmentId: 'SHIP-400',
      status: 'ARRIVED',
      version: 3,
      location: 'Rotterdam Port',
      temperature: 4,
    };
    const events = [
      { version: 1, eventType: 'CONTAINER_CREATED' },
      { version: 2, eventType: 'LOADED_ON_SHIP' },
      { version: 3, eventType: 'ARRIVED_AT_PORT' },
    ];

    const model = resolveShipmentDisplayModel(stateData, events);
    assert.strictEqual(model.shipmentId, 'SHIP-400');
    assert.strictEqual(model.status, 'ARRIVED');
    assert.strictEqual(model.version, 3);
    assert.strictEqual(model.location, 'Rotterdam Port');
    assert.strictEqual(model.temperature, '4°C');
    assert.strictEqual(model.eventCount, 3);
    assert.strictEqual(model.isReconstructed, true);
  });

  await t.test('handles null state data gracefully', () => {
    assert.strictEqual(resolveShipmentDisplayModel(null), null);
  });
});
