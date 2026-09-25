/**
 * Global Maritime Ports Database & Coordinate Projection Utilities
 * Maps real-world ports and logistics hubs to geographic coordinates and SVG projection space.
 */

export const MAJOR_PORTS = {
  SHANGHAI: {
    id: 'SHANGHAI',
    name: 'Port of Shanghai',
    aliases: ['shanghai', 'port of shanghai', 'shanghai marine terminal', 'shanghai port'],
    country: 'China',
    lat: 31.2304,
    lon: 121.4737,
    region: 'East Asia'
  },
  ROTTERDAM: {
    id: 'ROTTERDAM',
    name: 'Port of Rotterdam',
    aliases: ['rotterdam', 'port of rotterdam', 'rotterdam terminal 4', 'rotterdam terminals', 'port of rotterdam terminals', 'port of rotterdam terminal 4'],
    country: 'Netherlands',
    lat: 51.9244,
    lon: 4.4777,
    region: 'Northern Europe'
  },
  ANTWERP: {
    id: 'ANTWERP',
    name: 'Port of Antwerp',
    aliases: ['antwerp', 'port of antwerp', 'antwerp gateway'],
    country: 'Belgium',
    lat: 51.2194,
    lon: 4.4025,
    region: 'Western Europe'
  },
  SINGAPORE: {
    id: 'SINGAPORE',
    name: 'Port of Singapore',
    aliases: ['singapore', 'port of singapore', 'singapore berth 4', 'port of singapore berth 4'],
    country: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    region: 'Southeast Asia'
  },
  HAMBURG: {
    id: 'HAMBURG',
    name: 'Port of Hamburg',
    aliases: ['hamburg', 'port of hamburg', 'hamburg logistics facility'],
    country: 'Germany',
    lat: 53.5511,
    lon: 9.9937,
    region: 'Northern Europe'
  },
  BUSAN: {
    id: 'BUSAN',
    name: 'Port of Busan',
    aliases: ['busan', 'port of busan', 'busan pier 1'],
    country: 'South Korea',
    lat: 35.1796,
    lon: 129.0756,
    region: 'East Asia'
  },
  TOKYO: {
    id: 'TOKYO',
    name: 'Port of Tokyo',
    aliases: ['tokyo', 'port of tokyo', 'yokohama', 'yokohama terminal 2'],
    country: 'Japan',
    lat: 35.6762,
    lon: 139.6503,
    region: 'East Asia'
  },
  LOS_ANGELES: {
    id: 'LOS_ANGELES',
    name: 'Port of Los Angeles',
    aliases: ['los angeles', 'port of los angeles', 'long beach'],
    country: 'United States',
    lat: 33.7431,
    lon: -118.2673,
    region: 'North America'
  },
  COLOMBO: {
    id: 'COLOMBO',
    name: 'Port of Colombo',
    aliases: ['colombo', 'port of colombo'],
    country: 'Sri Lanka',
    lat: 6.9271,
    lon: 79.8612,
    region: 'South Asia'
  },
  DUBAI: {
    id: 'DUBAI',
    name: 'Port of Jebel Ali (Dubai)',
    aliases: ['dubai', 'jebel ali', 'port of dubai'],
    country: 'UAE',
    lat: 25.0657,
    lon: 55.1713,
    region: 'Middle East'
  },
  MUMBAI: {
    id: 'MUMBAI',
    name: 'Port of Nhava Sheva (Mumbai)',
    aliases: ['mumbai', 'nhava sheva', 'port of mumbai'],
    country: 'India',
    lat: 18.9499,
    lon: 72.9512,
    region: 'South Asia'
  },
  INDIAN_OCEAN: {
    id: 'INDIAN_OCEAN',
    name: 'Indian Ocean Transit Zone',
    aliases: ['indian ocean', 'bay of bengal', 'arabian sea'],
    country: 'International Waters',
    lat: -5.0,
    lon: 80.0,
    region: 'High Seas'
  },
  NORTH_SEA: {
    id: 'NORTH_SEA',
    name: 'North Sea Marine Corridor',
    aliases: ['north sea', 'english channel'],
    country: 'International Waters',
    lat: 56.0,
    lon: 3.5,
    region: 'High Seas'
  }
};

/**
 * Resolves a text location name or string to a canonical port definition.
 *
 * @param {string} locationStr - E.g. "Port of Shanghai", "Shanghai Marine Terminal"
 * @returns {Object|null} Matched port entry or null
 */
export function resolvePortLocation(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') return null;

  const normalized = locationStr.trim().toLowerCase();

  for (const port of Object.values(MAJOR_PORTS)) {
    if (port.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
      return port;
    }
  }

  return null;
}

/**
 * Projects latitude and longitude coordinates to 2D equirectangular SVG space.
 *
 * @param {number} lat - Latitude (-90 to 90)
 * @param {number} lon - Longitude (-180 to 180)
 * @param {number} width - Target SVG width in pixels (default: 1000)
 * @param {number} height - Target SVG height in pixels (default: 500)
 * @returns {{x: number, y: number}} SVG coordinate point
 */
export function latLonToSvg(lat, lon, width = 1000, height = 500) {
  const clampedLat = Math.max(-90, Math.min(90, lat));
  const clampedLon = Math.max(-180, Math.min(180, lon));

  const x = (clampedLon + 180) * (width / 360);
  const y = (90 - clampedLat) * (height / 180);

  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10
  };
}

/**
 * Interpolates vessel coordinates between origin and destination based on version progression.
 *
 * @param {Object} originPort - Starting port
 * @param {Object} destPort - Ending port
 * @param {number} progress - Normalised progress between 0.0 (origin) and 1.0 (destination)
 * @returns {{lat: number, lon: number, heading: number}}
 */
export function interpolateVesselPosition(originPort, destPort, progress = 0) {
  const p = Math.max(0, Math.min(1, progress));

  if (!originPort && !destPort) {
    return { lat: 10.0, lon: 60.0, heading: 90 };
  }

  if (!destPort) {
    return { lat: originPort.lat, lon: originPort.lon, heading: 0 };
  }

  if (!originPort) {
    return { lat: destPort.lat, lon: destPort.lon, heading: 0 };
  }

  if (p === 0) {
    return { lat: originPort.lat, lon: originPort.lon, heading: 90 };
  }

  if (p === 1) {
    return { lat: destPort.lat, lon: destPort.lon, heading: 0 };
  }

  // Handle longitudinal wraparound across the 180th meridian if needed
  let dLon = destPort.lon - originPort.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;

  // Great-circle style slight curved arc in latitude
  const latArc = Math.sin(p * Math.PI) * 6.0;
  const lat = originPort.lat + (destPort.lat - originPort.lat) * p + latArc;
  const lon = originPort.lon + dLon * p;

  // Approximate heading in degrees
  const angleRad = Math.atan2(destPort.lat - originPort.lat, dLon);
  const heading = Math.round(((angleRad * 180) / Math.PI + 360) % 360);

  return {
    lat: Math.round(lat * 10000) / 10000,
    lon: Math.round(lon * 10000) / 10000,
    heading
  };
}

/**
 * Formats decimal latitude and longitude into standard nautical format (DMS).
 * E.g. "31°14' N, 121°28' E"
 *
 * @param {number} lat - Decimal latitude
 * @param {number} lon - Decimal longitude
 * @returns {string} Nautical coordinates string
 */
export function formatNauticalCoordinates(lat, lon) {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
    return '00°00\' N, 00°00\' E';
  }

  const latDeg = Math.floor(Math.abs(lat));
  const latMin = Math.round((Math.abs(lat) - latDeg) * 60);
  const latDir = lat >= 0 ? 'N' : 'S';

  const lonDeg = Math.floor(Math.abs(lon));
  const lonMin = Math.round((Math.abs(lon) - lonDeg) * 60);
  const lonDir = lon >= 0 ? 'E' : 'W';

  return `${latDeg}°${latMin.toString().padStart(2, '0')}' ${latDir}, ${lonDeg}°${lonMin.toString().padStart(2, '0')}' ${lonDir}`;
}
