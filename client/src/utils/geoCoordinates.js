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

/**
 * Global Maritime Corridor Transit Waypoints & Chokepoints
 */
export const CORRIDOR_WAYPOINTS = [
  {
    id: 'WP_MALACCA',
    name: 'Strait of Malacca Waypoint',
    shortName: 'Strait of Malacca',
    lat: 2.5,
    lon: 101.5,
    region: 'Southeast Asia',
    type: 'WAYPOINT'
  },
  {
    id: 'WP_COLOMBO',
    name: 'Port of Colombo Hub',
    shortName: 'Colombo Hub',
    lat: 6.9271,
    lon: 79.8612,
    region: 'South Asia',
    type: 'WAYPOINT'
  },
  {
    id: 'WP_BAB_EL_MANDEB',
    name: 'Bab-el-Mandeb Strait',
    shortName: 'Bab-el-Mandeb',
    lat: 12.58,
    lon: 43.33,
    region: 'Red Sea Gate',
    type: 'WAYPOINT'
  },
  {
    id: 'WP_SUEZ',
    name: 'Suez Canal Transit Corridor',
    shortName: 'Suez Canal',
    lat: 29.97,
    lon: 32.55,
    region: 'Middle East',
    type: 'WAYPOINT'
  },
  {
    id: 'WP_GIBRALTAR',
    name: 'Strait of Gibraltar Gateway',
    shortName: 'Strait of Gibraltar',
    lat: 35.95,
    lon: -5.6,
    region: 'Mediterranean Gate',
    type: 'WAYPOINT'
  },
  {
    id: 'WP_ENGLISH_CHANNEL',
    name: 'English Channel Approaches',
    shortName: 'English Channel',
    lat: 49.8,
    lon: -2.5,
    region: 'Northern Europe',
    type: 'WAYPOINT'
  }
];

/**
 * Returns key named locations and waypoints along the route between origin and destination.
 *
 * @param {Object} originPort - Starting port object
 * @param {Object} destPort - Terminating port object
 * @returns {Array<Object>} Ordered list of locations (Origin, Waypoints, Destination)
 */
export function getRouteCorridorLocations(originPort, destPort) {
  const origin = originPort || MAJOR_PORTS.SHANGHAI;
  const dest = destPort || MAJOR_PORTS.ROTTERDAM;

  const locations = [
    {
      id: `ORIGIN_${origin.id}`,
      name: origin.name,
      shortName: origin.name.replace(/^Port of\s+/i, ''),
      country: origin.country || 'Origin Hub',
      lat: origin.lat,
      lon: origin.lon,
      type: 'ORIGIN'
    }
  ];

  // If sailing between East Asia / South Asia and Europe / West, insert relevant corridor waypoints
  const isAsiaToEurope = (origin.lon > 60 && dest.lon < 20) || (origin.lon < 20 && dest.lon > 60);

  if (isAsiaToEurope) {
    CORRIDOR_WAYPOINTS.forEach((wp) => {
      locations.push({
        id: wp.id,
        name: wp.name,
        shortName: wp.shortName,
        country: wp.region,
        lat: wp.lat,
        lon: wp.lon,
        type: 'WAYPOINT'
      });
    });
  } else {
    // Generate synthetic mid-route waypoints based on interpolation
    const mid1 = interpolateVesselPosition(origin, dest, 0.33);
    const mid2 = interpolateVesselPosition(origin, dest, 0.67);
    locations.push({
      id: 'WP_MID_ALPHA',
      name: 'Transit Waypoint Alpha',
      shortName: 'Waypoint Alpha',
      country: 'International Waters',
      lat: mid1.lat,
      lon: mid1.lon,
      type: 'WAYPOINT'
    });
    locations.push({
      id: 'WP_MID_BETA',
      name: 'Transit Waypoint Beta',
      shortName: 'Waypoint Beta',
      country: 'High Seas Corridor',
      lat: mid2.lat,
      lon: mid2.lon,
      type: 'WAYPOINT'
    });
  }

  locations.push({
    id: `DEST_${dest.id}`,
    name: dest.name,
    shortName: dest.name.replace(/^Port of\s+/i, ''),
    country: dest.country || 'Destination Port',
    lat: dest.lat,
    lon: dest.lon,
    type: 'DESTINATION'
  });

  return locations;
}

/**
 * Resolves a human-readable location and sector name for the vessel's current position.
 *
 * @param {Object} vesselGeo - Current coordinates { lat, lon }
 * @param {Object} originPort - Starting port
 * @param {Object} destPort - Destination port
 * @param {number} progressRatio - 0.0 to 1.0
 * @param {Object} activeState - Current state from event fold
 * @returns {string} Human-readable current location name
 */
export function resolveVesselCurrentLocationName(vesselGeo, originPort, destPort, progressRatio, activeState) {
  if (activeState?.status === 'CREATED' || progressRatio <= 0.02) {
    return `${originPort?.name || 'Origin Port'} (Berthed)`;
  }
  if (activeState?.status === 'ARRIVED' || progressRatio >= 0.98) {
    return `${destPort?.name || 'Destination Port'} (Discharged)`;
  }

  // Check proximity to any corridor waypoint (within ~15 degrees)
  for (const wp of CORRIDOR_WAYPOINTS) {
    const dLat = Math.abs(vesselGeo.lat - wp.lat);
    const dLon = Math.abs(vesselGeo.lon - wp.lon);
    if (dLat < 6 && dLon < 10) {
      return `Near ${wp.name}`;
    }
  }

  // Geographic sector determination
  const { lat, lon } = vesselGeo;
  if (lon > 100 && lat > 10) return 'East China Sea / South China Sea';
  if (lon > 90 && lat <= 15) return 'Strait of Malacca Approach';
  if (lon > 60 && lon <= 90 && lat < 25) return 'Indian Ocean Oceanic Corridor';
  if (lon > 40 && lon <= 60 && lat > 10) return 'Arabian Sea / Gulf of Aden';
  if (lon > 30 && lon <= 45 && lat > 15 && lat < 30) return 'Red Sea Shipping Lane';
  if (lon > 10 && lon <= 35 && lat > 30) return 'Mediterranean Sea Transit Basin';
  if (lon >= -10 && lon <= 10 && lat > 30 && lat < 45) return 'Strait of Gibraltar / Iberian Coast';
  if (lat >= 45 && lon >= -5 && lon <= 10) return 'English Channel & North Sea Approaches';

  return `Oceanic Corridor (${formatNauticalCoordinates(lat, lon)})`;
}

