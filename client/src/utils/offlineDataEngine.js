/**
 * Offline & Resilient Data Engine for Audit Trail
 *
 * Provides instant (<50ms) client-side event sourcing, state reconstruction,
 * telemetry time-series, and OCC command execution when the remote backend
 * is sleeping, starting up, or unreachable.
 */

const STORAGE_KEY = 'audit_trail_offline_events';

// Canonical logistics scenarios
const DEFAULT_SCENARIOS = {
  'SHIP-001': [
    {
      _id: 'evt-001-1',
      aggregateId: 'SHIP-001',
      eventType: 'CONTAINER_CREATED',
      version: 1,
      payload: {
        cargo: 'Consumer Electronics & Microchips',
        origin: 'Port of Shanghai, China',
        destination: 'Port of Rotterdam, Netherlands',
        temperature: 4.0,
        threshold: 8.0,
        humidity: 50.0,
        batteryVoltage: 3.92
      },
      timestamp: new Date(Date.now() - 4 * 86400000).toISOString()
    },
    {
      _id: 'evt-001-2',
      aggregateId: 'SHIP-001',
      eventType: 'LOADED_ON_SHIP',
      version: 2,
      payload: {
        vessel: 'MV Pacific Voyager',
        port: 'Port of Shanghai Terminal 3',
        location: 'Shanghai Coastal Transit',
        temperature: 4.2,
        threshold: 8.0,
        humidity: 52.0,
        batteryVoltage: 3.88
      },
      timestamp: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      _id: 'evt-001-3',
      aggregateId: 'SHIP-001',
      eventType: 'TEMPERATURE_SPIKE',
      version: 3,
      payload: {
        temperature: 13.5,
        threshold: 8.0,
        humidity: 78.5,
        ambientTemp: 28.5,
        batteryVoltage: 3.75,
        reason: 'Reefer power fluctuation in Indian Ocean',
        coordinates: { lat: 5.9234, lng: 80.5213 }
      },
      timestamp: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      _id: 'evt-001-4',
      aggregateId: 'SHIP-001',
      eventType: 'ARRIVED_AT_PORT',
      version: 4,
      payload: {
        port: 'Port of Rotterdam Terminal 4',
        location: 'Port of Rotterdam Berth 12',
        temperature: 4.1,
        threshold: 8.0,
        humidity: 55.0,
        batteryVoltage: 3.65
      },
      timestamp: new Date(Date.now() - 1 * 86400000).toISOString()
    }
  ],

  'SHIP-TEMP-ALERT': [
    {
      _id: 'evt-alert-1',
      aggregateId: 'SHIP-TEMP-ALERT',
      eventType: 'CONTAINER_CREATED',
      version: 1,
      payload: {
        cargo: 'Vaccines & Biopharmaceuticals',
        origin: 'Port of Tokyo, Japan',
        destination: 'Port of Los Angeles, USA',
        temperature: 3.5,
        threshold: 5.0,
        humidity: 45.0,
        batteryVoltage: 3.95
      },
      timestamp: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      _id: 'evt-alert-2',
      aggregateId: 'SHIP-TEMP-ALERT',
      eventType: 'LOADED_ON_SHIP',
      version: 2,
      payload: {
        vessel: 'MV Ocean Arctic',
        port: 'Tokyo Container Berth 2',
        location: 'North Pacific Great-Circle Corridor',
        temperature: 3.8,
        threshold: 5.0,
        humidity: 48.0,
        batteryVoltage: 3.89
      },
      timestamp: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      _id: 'evt-alert-3',
      aggregateId: 'SHIP-TEMP-ALERT',
      eventType: 'TEMPERATURE_SPIKE',
      version: 3,
      payload: {
        temperature: 15.2,
        threshold: 5.0,
        humidity: 82.0,
        ambientTemp: 29.8,
        batteryVoltage: 3.68,
        reason: 'Thermal insulation breach detected during open water transit',
        coordinates: { lat: 38.5211, lng: -165.2341 }
      },
      timestamp: new Date(Date.now() - 1 * 86400000).toISOString()
    }
  ],

  'CONT-GENESIS-99': [
    {
      _id: 'evt-genesis-1',
      aggregateId: 'CONT-GENESIS-99',
      eventType: 'CONTAINER_CREATED',
      version: 1,
      payload: {
        cargo: 'Industrial Automation Sensors',
        origin: 'Port of Singapore',
        destination: 'Port of Antwerp, Belgium',
        temperature: 21.0,
        threshold: 25.0,
        humidity: 40.0,
        batteryVoltage: 3.98
      },
      timestamp: new Date(Date.now() - 86400000).toISOString()
    }
  ],

  'SHIP-PHARMA-2026-EU-JP': [
    {
      _id: 'evt-pharma-1',
      aggregateId: 'SHIP-PHARMA-2026-EU-JP',
      eventType: 'CONTAINER_CREATED',
      version: 1,
      payload: {
        cargo: 'Pfizer-BioNTech mRNA COVID Vaccines (10,000 Vials)',
        origin: 'Berlin Central Bio-Hub, Germany',
        destination: 'Port of Tokyo Cold Terminal, Japan',
        temperature: 4.2,
        threshold: 8.0,
        humidity: 48.0,
        batteryVoltage: 3.95
      },
      timestamp: new Date(Date.now() - 4 * 86400000).toISOString()
    },
    {
      _id: 'evt-pharma-2',
      aggregateId: 'SHIP-PHARMA-2026-EU-JP',
      eventType: 'LOADED_ON_SHIP',
      version: 2,
      payload: {
        vessel: 'Polar Frost Express',
        port: 'Port of Hamburg Terminal',
        location: 'North Sea Maritime Lane',
        temperature: 4.5,
        threshold: 8.0,
        humidity: 50.0,
        batteryVoltage: 3.88
      },
      timestamp: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      _id: 'evt-pharma-3',
      aggregateId: 'SHIP-PHARMA-2026-EU-JP',
      eventType: 'TEMPERATURE_SPIKE',
      version: 3,
      payload: {
        temperature: 11.8,
        threshold: 8.0,
        humidity: 79.5,
        ambientTemp: 29.4,
        batteryVoltage: 3.65,
        reason: 'Reefer power failure in tropical ocean sector',
        coordinates: { lat: 12.8797, lng: 121.774 }
      },
      timestamp: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      _id: 'evt-pharma-4',
      aggregateId: 'SHIP-PHARMA-2026-EU-JP',
      eventType: 'ARRIVED_AT_PORT',
      version: 4,
      payload: {
        port: 'Port of Tokyo Cold Terminal',
        location: 'Tokyo Berth 7 Cold Facility',
        temperature: 3.9,
        threshold: 8.0,
        humidity: 52.0,
        batteryVoltage: 3.55
      },
      timestamp: new Date(Date.now() - 1 * 86400000).toISOString()
    }
  ],

  'SHIP-OCEAN-2026-ROT-SGP': [
    {
      _id: 'evt-ocean-1',
      aggregateId: 'SHIP-OCEAN-2026-ROT-SGP',
      eventType: 'CONTAINER_CREATED',
      version: 1,
      payload: {
        cargo: 'TSMC High-Density Semiconductor Processors',
        origin: 'Port of Rotterdam, Netherlands',
        destination: 'Port of Singapore',
        temperature: 20.5,
        threshold: 25.0,
        humidity: 42.0,
        batteryVoltage: 3.92
      },
      timestamp: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      _id: 'evt-ocean-2',
      aggregateId: 'SHIP-OCEAN-2026-ROT-SGP',
      eventType: 'LOADED_ON_SHIP',
      version: 2,
      payload: {
        vessel: 'Ever Glory Mega-Vessel',
        port: 'Port of Rotterdam Gateway',
        location: 'Mediterranean Transit Corridor',
        temperature: 21.0,
        threshold: 25.0,
        humidity: 44.0,
        batteryVoltage: 3.86
      },
      timestamp: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      _id: 'evt-ocean-3',
      aggregateId: 'SHIP-OCEAN-2026-ROT-SGP',
      eventType: 'ARRIVED_AT_PORT',
      version: 3,
      payload: {
        port: 'Port of Singapore Pasir Panjang Terminal',
        location: 'Singapore Berth 14',
        temperature: 22.1,
        threshold: 25.0,
        humidity: 46.0,
        batteryVoltage: 3.78
      },
      timestamp: new Date(Date.now() - 86400000).toISOString()
    }
  ]
};

// Safe local storage helpers
function getStoredStore() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SCENARIOS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SCENARIOS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SCENARIOS, ...parsed };
  } catch (err) {
    console.warn('Could not read from localStorage, using memory defaults:', err);
    return { ...DEFAULT_SCENARIOS };
  }
}

function saveStoredStore(store) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('Could not save to localStorage:', err);
  }
}

// Generate realistic deterministic events for arbitrary shipment IDs
function generateDynamicScenario(shipmentId) {
  const normId = String(shipmentId).trim().toUpperCase();
  const now = Date.now();

  return [
    {
      _id: `evt-dyn-${normId}-1`,
      aggregateId: normId,
      eventType: 'CONTAINER_CREATED',
      version: 1,
      payload: {
        cargo: 'Commercial Air-Freight Freight Package',
        origin: 'International Logistics Hub',
        destination: 'Destination Maritime Terminal',
        temperature: 4.5,
        threshold: 8.0,
        humidity: 48.0,
        batteryVoltage: 3.94
      },
      timestamp: new Date(now - 3 * 86400000).toISOString()
    },
    {
      _id: `evt-dyn-${normId}-2`,
      aggregateId: normId,
      eventType: 'LOADED_ON_SHIP',
      version: 2,
      payload: {
        vessel: 'Global Carrier Line',
        port: 'Origin Terminal Berth 2',
        location: 'Coastal Oceanic Corridor',
        temperature: 4.8,
        threshold: 8.0,
        humidity: 51.0,
        batteryVoltage: 3.87
      },
      timestamp: new Date(now - 2 * 86400000).toISOString()
    },
    {
      _id: `evt-dyn-${normId}-3`,
      aggregateId: normId,
      eventType: 'ARRIVED_AT_PORT',
      version: 3,
      payload: {
        port: 'Destination Maritime Terminal',
        location: 'Discharged at Terminal Gate',
        temperature: 4.2,
        threshold: 8.0,
        humidity: 49.0,
        batteryVoltage: 3.8
      },
      timestamp: new Date(now - 86400000).toISOString()
    }
  ];
}

// Pure event state fold
export function foldEvents(events, maxVersion = null) {
  if (!Array.isArray(events) || events.length === 0) return null;

  const filtered = maxVersion !== null
    ? events.filter((e) => e.version <= maxVersion)
    : events;

  const sorted = [...filtered].sort((a, b) => a.version - b.version);

  const initial = {
    shipmentId: sorted[0]?.aggregateId || null,
    status: 'UNKNOWN',
    location: null,
    temperature: null,
    threshold: 8.0,
    vessel: null,
    cargo: null,
    version: 0,
    lastAppliedVersion: 0,
    _source: 'offline_ledger'
  };

  return sorted.reduce((state, event) => {
    const payload = event.payload || {};
    const next = {
      ...state,
      version: event.version,
      lastAppliedVersion: event.version
    };

    if (payload.temperature !== undefined) next.temperature = Number(payload.temperature);
    if (payload.threshold !== undefined) next.threshold = Number(payload.threshold);

    switch (event.eventType) {
      case 'CONTAINER_CREATED':
        next.shipmentId = event.aggregateId;
        next.status = 'CREATED';
        next.location = payload.origin || 'Origin Facility';
        next.cargo = payload.cargo || 'General Freight';
        break;
      case 'LOADED_ON_SHIP':
        next.status = 'LOADED';
        next.location = payload.port || payload.location || state.location;
        next.vessel = payload.vessel || 'Vessel 01';
        break;
      case 'TEMPERATURE_SPIKE':
        next.status = 'ALERT';
        break;
      case 'ARRIVED_AT_PORT':
        next.status = 'ARRIVED';
        next.location = payload.port || payload.location || state.location;
        break;
      default:
        break;
    }
    return next;
  }, initial);
}

// Retrieve events
export function getOfflineEvents(shipmentId) {
  if (!shipmentId) return [];
  const normId = String(shipmentId).trim().toUpperCase();
  const store = getStoredStore();

  if (store[normId]) {
    return store[normId];
  }

  // Create and persist dynamic scenario for newly searched ID
  const dynamic = generateDynamicScenario(normId);
  store[normId] = dynamic;
  saveStoredStore(store);
  return dynamic;
}

// Retrieve state
export function getOfflineState(shipmentId) {
  const events = getOfflineEvents(shipmentId);
  return foldEvents(events, null);
}

// Retrieve point-in-time state
export function getOfflineStateAsOf(shipmentId, target) {
  const events = getOfflineEvents(shipmentId);
  let targetVer = null;

  if (typeof target === 'number') {
    targetVer = target;
  } else if (typeof target === 'string') {
    const m = target.match(/^v?([0-9]+)$/i);
    if (m) targetVer = parseInt(m[1], 10);
  }

  return foldEvents(events, targetVer);
}

// Generate rich telemetry time-series
export function getOfflineTelemetry(shipmentId) {
  const events = getOfflineEvents(shipmentId);
  if (!events || events.length === 0) return null;

  let lastTemp = 4.0;
  let lastThreshold = 8.0;
  let lastHumidity = 50.0;
  let lastVoltage = 3.9;

  const timeSeries = events.map((event) => {
    const p = event.payload || {};
    if (p.temperature !== undefined) lastTemp = Number(p.temperature);
    if (p.threshold !== undefined) lastThreshold = Number(p.threshold);
    if (p.humidity !== undefined) lastHumidity = Number(p.humidity);
    if (p.batteryVoltage !== undefined) lastVoltage = Number(p.batteryVoltage);

    const isAnomaly = event.eventType === 'TEMPERATURE_SPIKE' || lastTemp > lastThreshold;

    return {
      version: event.version,
      eventType: event.eventType,
      timestamp: event.timestamp || new Date().toISOString(),
      temperature: lastTemp,
      threshold: lastThreshold,
      humidity: lastHumidity,
      batteryVoltage: lastVoltage,
      ambientTemp: p.ambientTemp ?? (lastTemp + 15),
      isAnomaly,
      severity: isAnomaly ? 'CRITICAL' : 'NORMAL'
    };
  });

  const temps = timeSeries.map((t) => t.temperature);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const avgTemp = Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1));
  const anomaliesCount = timeSeries.filter((t) => t.isAnomaly).length;

  return {
    shipmentId: String(shipmentId).trim().toUpperCase(),
    totalDataPoints: timeSeries.length,
    metrics: {
      minTemperature: minTemp,
      maxTemperature: maxTemp,
      avgTemperature: avgTemp,
      meanTemperature: avgTemp,
      criticalThreshold: lastThreshold,
      anomaliesDetected: anomaliesCount,
      latestBatteryVoltage: lastVoltage,
      latestHumidity: lastHumidity
    },
    summary: {
      minTemp,
      maxTemp,
      avgTemp,
      anomaliesCount,
      currentThreshold: lastThreshold
    },
    timeSeries
  };
}

// Apply offline command with OCC validation
export function applyOfflineCommand(endpoint, payload) {
  const store = getStoredStore();
  const parts = endpoint.split('/').filter(Boolean);
  const action = parts[parts.length - 1]; // 'create', 'load', 'temperature-spike', 'arrive'
  const shipmentId = payload.aggregateId || payload.shipmentId || parts[parts.length - 2] || 'SHIP-NEW';
  const normId = String(shipmentId).trim().toUpperCase();

  const currentEvents = store[normId] || [];
  const currentVersion = currentEvents.length > 0 ? currentEvents[currentEvents.length - 1].version : 0;

  // OCC Check
  if (payload.expectedVersion !== undefined && payload.expectedVersion !== null) {
    if (payload.expectedVersion !== currentVersion) {
      const occErr = new Error(`OCC Concurrency Conflict: Expected version ${payload.expectedVersion} but current version is ${currentVersion}`);
      occErr.status = 409;
      occErr.data = {
        error: 'ConcurrencyConflict',
        message: `OCC Concurrency Conflict: Expected version ${payload.expectedVersion} but current version is ${currentVersion}`,
        expectedVersion: payload.expectedVersion,
        currentVersion
      };
      throw occErr;
    }
  }

  let eventType = 'CONTAINER_CREATED';
  if (action === 'load') eventType = 'LOADED_ON_SHIP';
  else if (action === 'temperature-spike') eventType = 'TEMPERATURE_SPIKE';
  else if (action === 'arrive') eventType = 'ARRIVED_AT_PORT';

  const newEvent = {
    _id: `evt-local-${normId}-${currentVersion + 1}`,
    aggregateId: normId,
    eventType,
    version: currentVersion + 1,
    payload: { ...payload },
    timestamp: new Date().toISOString()
  };

  const updatedEvents = [...currentEvents, newEvent];
  store[normId] = updatedEvents;
  saveStoredStore(store);

  return {
    success: true,
    aggregateId: normId,
    version: newEvent.version,
    event: newEvent
  };
}
