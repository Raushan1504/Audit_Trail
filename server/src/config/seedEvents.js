const Event = require('../models/Event');
const { EVENT_TYPES } = require('../events/eventTypes');

const DEMO_EVENTS = [
  // SHIP-001: Standard Sea Freight (Full 4-event sequence)
  {
    aggregateId: 'SHIP-001',
    eventType: EVENT_TYPES.CONTAINER_CREATED,
    version: 1,
    payload: { origin: 'Port of Shanghai', cargo: 'Solar Photovoltaic Modules', destination: 'Port of Rotterdam' },
    timestamp: new Date(Date.now() - 4 * 86400000)
  },
  {
    aggregateId: 'SHIP-001',
    eventType: EVENT_TYPES.LOADED_ON_SHIP,
    version: 2,
    payload: { port: 'Shanghai Marine Terminal', vessel: 'MV PACIFIC VOYAGER' },
    timestamp: new Date(Date.now() - 3 * 86400000)
  },
  {
    aggregateId: 'SHIP-001',
    eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
    version: 3,
    payload: { temperature: 13.5, threshold: 4.0 },
    timestamp: new Date(Date.now() - 2 * 86400000)
  },
  {
    aggregateId: 'SHIP-001',
    eventType: EVENT_TYPES.ARRIVED_AT_PORT,
    version: 4,
    payload: { port: 'Port of Rotterdam Terminal 4' },
    timestamp: new Date(Date.now() - 1 * 86400000)
  },

  // SHIP-TEMP-ALERT: Cold Chain Anomaly
  {
    aggregateId: 'SHIP-TEMP-ALERT',
    eventType: EVENT_TYPES.CONTAINER_CREATED,
    version: 1,
    payload: { origin: 'Port of Antwerp', cargo: 'Temperature-Sensitive Vaccines', destination: 'Port of Singapore' },
    timestamp: new Date(Date.now() - 3 * 86400000)
  },
  {
    aggregateId: 'SHIP-TEMP-ALERT',
    eventType: EVENT_TYPES.LOADED_ON_SHIP,
    version: 2,
    payload: { port: 'Antwerp Gateway', vessel: 'MV NORDIC ARCTIC' },
    timestamp: new Date(Date.now() - 2 * 86400000)
  },
  {
    aggregateId: 'SHIP-TEMP-ALERT',
    eventType: EVENT_TYPES.TEMPERATURE_SPIKE,
    version: 3,
    payload: { temperature: 15.2, threshold: 2.0 },
    timestamp: new Date(Date.now() - 1 * 86400000)
  },

  // CONT-GENESIS-99: New Container Inception
  {
    aggregateId: 'CONT-GENESIS-99',
    eventType: EVENT_TYPES.CONTAINER_CREATED,
    version: 1,
    payload: { origin: 'Hamburg Logistics Facility', cargo: 'Precision Robotic Components', destination: 'Port of Busan' },
    timestamp: new Date()
  }
];

async function seedDefaultEvents() {
  try {
    for (const ev of DEMO_EVENTS) {
      const exists = await Event.findOne({ aggregateId: ev.aggregateId, version: ev.version });
      if (!exists) {
        await new Event(ev).save();
      }
    }
    console.log('✓ Default demo events seeded successfully for review demo.');
  } catch (err) {
    console.warn('Note on event seeding:', err.message);
  }
}

module.exports = { seedDefaultEvents, DEMO_EVENTS };
