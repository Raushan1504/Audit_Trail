/**
 * Event Metadata Resolver for Audit Trail Forensic State Scrubber
 */

export function formatEventName(type) {
  if (!type) return 'Unknown Event';
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function getEventMeta(event) {
  if (!event) {
    return {
      icon: '⏱',
      typeClass: 'event-type--unknown',
      label: 'Unknown Event',
      snippet: 'No payload data'
    };
  }

  const type = event.eventType;
  const p = event.payload || {};

  if (type === 'CONTAINER_CREATED') {
    return {
      icon: '📦',
      typeClass: 'event-type--created',
      label: 'Container Created',
      snippet: p.origin ? `Origin: ${p.origin}` : (p.cargo ? `Cargo: ${p.cargo}` : 'Genesis Inception')
    };
  }
  if (type === 'LOADED_ON_SHIP') {
    return {
      icon: '🚢',
      typeClass: 'event-type--loaded',
      label: 'Loaded on Ship',
      snippet: p.vessel ? `Vessel: ${p.vessel}` : (p.port ? `Port: ${p.port}` : 'Vessel Transit')
    };
  }
  if (type === 'TEMPERATURE_SPIKE') {
    return {
      icon: '🔥',
      typeClass: 'event-type--alert',
      label: 'Temperature Spike',
      snippet: p.temperature !== undefined ? `Temp: ${p.temperature}°C` : 'Thermal Excursion'
    };
  }
  if (type === 'ARRIVED_AT_PORT') {
    return {
      icon: '🏁',
      typeClass: 'event-type--arrived',
      label: 'Arrived at Port',
      snippet: p.port ? `Port: ${p.port}` : 'Terminal Arrival'
    };
  }

  return {
    icon: '⏱',
    typeClass: 'event-type--unknown',
    label: formatEventName(type),
    snippet: 'Domain Event Logged'
  };
}
