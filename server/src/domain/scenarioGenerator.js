
const SCENARIO_TYPES = Object.freeze({
  PHARMA: 'PHARMA',
  OCEAN_ELECTRONICS: 'OCEAN_ELECTRONICS',
  FROZEN_SEAFOOD: 'FROZEN_SEAFOOD'
});

const SCENARIO_TEMPLATES = Object.freeze({
  [SCENARIO_TYPES.PHARMA]: {
    defaultId: 'SHIP-PHARMA-2026-EU-JP',
    cargo: 'Pfizer-BioNTech mRNA COVID Vaccines (Pharma Cold-Chain)',
    origin: 'Berlin Central Hub, Germany',
    destination: 'Port of Tokyo, Japan',
    vessel: 'Polar Frost Express',
    loadPort: 'Port of Hamburg',
    arrivalPort: 'Port of Tokyo',
    events: [
      {
        version: 1,
        eventType: 'CONTAINER_CREATED',
        payload: {
          cargo: 'Pfizer-BioNTech mRNA COVID Vaccines (Pharma Cold-Chain)',
          origin: 'Berlin Central Hub, Germany',
          destination: 'Port of Tokyo, Japan',
          temperature: 4.2,
          threshold: 8.0,
          humidity: 48.0,
          batteryVoltage: 3.9,
          sensorId: 'SENSOR-PHARMA-01'
        }
      },
      {
        version: 2,
        eventType: 'LOADED_ON_SHIP',
        payload: {
          vessel: 'Polar Frost Express',
          port: 'Port of Hamburg',
          location: 'North Sea Transit',
          temperature: 4.5,
          threshold: 8.0,
          humidity: 50.0,
          batteryVoltage: 3.85,
          coordinates: { lat: 53.5511, lng: 9.9937 }
        }
      },
      {
        version: 3,
        eventType: 'TEMPERATURE_SPIKE',
        payload: {
          temperature: 11.8,
          threshold: 8.0,
          humidity: 79.5,
          ambientTemp: 29.4,
          batteryVoltage: 3.65,
          sensorId: 'SENSOR-PHARMA-01',
          coordinates: { lat: 12.8797, lng: 121.774 }
        }
      },
      {
        version: 4,
        eventType: 'ARRIVED_AT_PORT',
        payload: {
          port: 'Port of Tokyo',
          location: 'Discharged at Berth 7, Tokyo Cold Terminal',
          temperature: 3.9,
          threshold: 8.0,
          humidity: 52.0,
          batteryVoltage: 3.52,
          coordinates: { lat: 35.6762, lng: 139.6503 }
        }
      }
    ]
  },
  [SCENARIO_TYPES.OCEAN_ELECTRONICS]: {
    defaultId: 'SHIP-OCEAN-2026-ROT-SGP',
    cargo: 'TSMC High-Density Semiconductor Processors (Dry Ambient)',
    origin: 'Port of Rotterdam, Netherlands',
    destination: 'Port of Singapore',
    vessel: 'Ever Glory Mega-Vessel',
    loadPort: 'Port of Rotterdam',
    arrivalPort: 'Port of Singapore',
    events: [
      {
        version: 1,
        eventType: 'CONTAINER_CREATED',
        payload: {
          cargo: 'TSMC High-Density Semiconductor Processors (Dry Ambient)',
          origin: 'Port of Rotterdam, Netherlands',
          destination: 'Port of Singapore',
          temperature: 20.5,
          threshold: 25.0,
          humidity: 42.0,
          batteryVoltage: 3.92,
          sensorId: 'SENSOR-MICRO-88'
        }
      },
      {
        version: 2,
        eventType: 'LOADED_ON_SHIP',
        payload: {
          vessel: 'Ever Glory Mega-Vessel',
          port: 'Port of Rotterdam',
          location: 'Mediterranean Passage',
          temperature: 21.0,
          threshold: 25.0,
          humidity: 45.0,
          batteryVoltage: 3.88,
          coordinates: { lat: 36.1408, lng: -5.3536 }
        }
      },
      {
        version: 3,
        eventType: 'TEMPERATURE_SPIKE',
        payload: {
          temperature: 28.2,
          threshold: 25.0,
          humidity: 68.0,
          ambientTemp: 41.0,
          batteryVoltage: 3.75,
          sensorId: 'SENSOR-MICRO-88',
          coordinates: { lat: 27.8483, lng: 34.3055 }
        }
      },
      {
        version: 4,
        eventType: 'ARRIVED_AT_PORT',
        payload: {
          port: 'Port of Singapore',
          location: 'Pasir Panjang Terminal, Singapore',
          temperature: 22.1,
          threshold: 25.0,
          humidity: 49.0,
          batteryVoltage: 3.64,
          coordinates: { lat: 1.29027, lng: 103.851959 }
        }
      }
    ]
  },
  [SCENARIO_TYPES.FROZEN_SEAFOOD]: {
    defaultId: 'SHIP-FROZEN-2026-OSL-SYD',
    cargo: 'Deep-Freeze Norwegian Atlantic Salmon (Sub-Zero Food Chain)',
    origin: 'Port of Oslo, Norway',
    destination: 'Port of Sydney, Australia',
    vessel: 'Arctic Frost Navigator',
    loadPort: 'Port of Oslo',
    arrivalPort: 'Port of Sydney',
    events: [
      {
        version: 1,
        eventType: 'CONTAINER_CREATED',
        payload: {
          cargo: 'Deep-Freeze Norwegian Atlantic Salmon (Sub-Zero Food Chain)',
          origin: 'Port of Oslo, Norway',
          destination: 'Port of Sydney, Australia',
          temperature: -24.5,
          threshold: -18.0,
          humidity: 55.0,
          batteryVoltage: 3.95,
          sensorId: 'SENSOR-REEFER-07'
        }
      },
      {
        version: 2,
        eventType: 'LOADED_ON_SHIP',
        payload: {
          vessel: 'Arctic Frost Navigator',
          port: 'Port of Oslo',
          location: 'Cape of Good Hope Route',
          temperature: -22.0,
          threshold: -18.0,
          humidity: 58.0,
          batteryVoltage: 3.82,
          coordinates: { lat: -34.3587, lng: 18.4717 }
        }
      },
      {
        version: 3,
        eventType: 'TEMPERATURE_SPIKE',
        payload: {
          temperature: -7.5,
          threshold: -18.0,
          humidity: 84.0,
          ambientTemp: 24.5,
          batteryVoltage: 3.38,
          sensorId: 'SENSOR-REEFER-07',
          coordinates: { lat: -32.0, lng: 85.0 }
        }
      },
      {
        version: 4,
        eventType: 'ARRIVED_AT_PORT',
        payload: {
          port: 'Port of Sydney',
          location: 'Port Botany Container Terminal, Sydney',
          temperature: -21.0,
          threshold: -18.0,
          humidity: 60.0,
          batteryVoltage: 3.48,
          coordinates: { lat: -33.8688, lng: 151.2093 }
        }
      }
    ]
  }
});

function generateScenarioEvents(type, customShipmentId = null) {
  const template = SCENARIO_TEMPLATES[type] || SCENARIO_TEMPLATES[SCENARIO_TYPES.PHARMA];
  const aggregateId = customShipmentId || template.defaultId;
  const baseTime = Date.now() - 4 * 24 * 60 * 60 * 1000;

  return template.events.map((templateEvent, index) => {
    return {
      aggregateId,
      version: templateEvent.version,
      eventType: templateEvent.eventType,
      payload: { ...templateEvent.payload },
      timestamp: new Date(baseTime + index * 24 * 60 * 60 * 1000)
    };
  });
}

function buildAllEnterpriseScenarios() {
  return Object.keys(SCENARIO_TEMPLATES).map((key) => {
    const template = SCENARIO_TEMPLATES[key];
    return {
      shipmentId: template.defaultId,
      type: key,
      cargo: template.cargo,
      events: generateScenarioEvents(key)
    };
  });
}

module.exports = {
  SCENARIO_TYPES,
  SCENARIO_TEMPLATES,
  generateScenarioEvents,
  buildAllEnterpriseScenarios
};
