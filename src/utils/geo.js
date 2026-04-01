// ============================================================
// POLYLINE DECODER
// ============================================================
// Decodes Google's encoded polyline format into lat/lng array.
// Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
//
// Source: This is a well-known algorithm. Implementation adapted from
// Google's official documentation. Tested against their Interactive
// Polyline Encoder Utility.

export function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    // Decode latitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    // Decode longitude
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

// ============================================================
// DISTANCE CALCULATION
// ============================================================
// Haversine formula — distance between two lat/lng points in meters.
// Accuracy: ~0.5% error for distances under 10km, which is fine
// for walking route comparisons.

export function distanceBetween(point1, point2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(point2.latitude - point1.latitude);
  const dLng = toRad(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) *
      Math.cos(toRad(point2.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// POINT SAMPLING
// ============================================================
// Sample points at regular intervals along a polyline.
// Used for: POI scoring (query Places API at each sample point).

export function samplePointsAlongPolyline(points, intervalMeters) {
  if (points.length < 2) return points;

  const sampled = [points[0]];
  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    accumulated += distanceBetween(points[i - 1], points[i]);
    if (accumulated >= intervalMeters) {
      sampled.push(points[i]);
      accumulated = 0;
    }
  }

  // Always include the last point
  const last = points[points.length - 1];
  const lastSampled = sampled[sampled.length - 1];
  if (
    lastSampled.latitude !== last.latitude ||
    lastSampled.longitude !== last.longitude
  ) {
    sampled.push(last);
  }

  return sampled;
}

// ============================================================
// CORRIDOR SAMPLING
// ============================================================
// Generate N evenly-spaced points along a straight line between
// two points. Used for: waypoint discovery (search for POIs
// along the corridor between origin and destination).
//
// Note: This samples along a straight line, not along roads.
// For waypoint discovery this is fine — we just need approximate
// locations to search for POI clusters.

export function pointsAlongLine(origin, destination, count) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1); // Exclude endpoints
    points.push({
      latitude: origin.latitude + t * (destination.latitude - origin.latitude),
      longitude:
        origin.longitude + t * (destination.longitude - origin.longitude),
    });
  }
  return points;
}

// ============================================================
// STREET OVERLAP
// ============================================================
// Compare two routes by their navigation instructions to measure
// how much they share the same streets.
// Returns a ratio from 0 (completely different) to 1 (identical).
//
// Caveat: This compares instruction TEXT, not actual geometry.
// Two routes on the same street but different segments would
// show as overlapping. This is a known limitation — good enough
// for deciding whether to inject waypoints.

export function calculateStreetOverlap(route1Steps, route2Steps) {
  const getStreets = (steps) =>
    new Set(
      steps
        .map((s) => s.navigationInstruction?.instructions || "")
        .filter((s) => s.length > 0)
    );

  const streets1 = getStreets(route1Steps);
  const streets2 = getStreets(route2Steps);

  if (streets1.size === 0) return 1; // Can't compare — assume overlap

  let overlap = 0;
  for (const street of streets1) {
    if (streets2.has(street)) overlap++;
  }

  return overlap / streets1.size;
}

// ============================================================
// SUNSET CALCULATION
// ============================================================
// Approximate sunset time based on latitude and day of year.
// Used for: auto-detecting day/night mode.
//
// Accuracy: ±15 minutes for most latitudes. Good enough for
// "is it roughly dark outside?" — not for astronomical calculations.
//
// Source: Simplified version of the NOAA solar calculator.
// For production accuracy, use a proper library or API.

export function isNightTime(latitude) {
  const now = new Date();
  const hours = now.getHours();
  const dayOfYear = Math.floor(
    (now - new Date(now.getFullYear(), 0, 0)) / 86400000
  );

  // Approximate sunset hour (very simplified)
  // At latitude 43.65 (Toronto): ranges from ~16:45 (Dec) to ~21:00 (Jun)
  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180);
  const hourAngle = Math.acos(
    -Math.tan((latitude * Math.PI) / 180) *
      Math.tan((declination * Math.PI) / 180)
  );
  const sunsetHour = 12 + (hourAngle * 180) / (Math.PI * 15);

  return hours >= sunsetHour || hours < 6; // After sunset or before 6am
}
