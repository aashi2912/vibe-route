/**
 * Client wrapper for Places search.
 *
 * SECURITY: This no longer calls Google directly. It calls our
 * /api/places proxy, which holds the REST key server-side.
 * No Google key is referenced in this file or shipped in the bundle.
 *
 * Cost control (unchanged): sample route points every ~400m, cap queries,
 * and cache per-location results in memory for the session.
 */

// Simple in-memory cache to avoid re-querying the same location
const poiCache = new Map();

function cacheKey(lat, lng, types) {
  return `${lat.toFixed(4)},${lng.toFixed(4)},${types.join(",")}`;
}

export async function searchNearby(location, options = {}) {
  const {
    types = ["park", "cafe", "coffee_shop", "restaurant"],
    radius = 200,
    maxResults = 5,
  } = options;

  const key = cacheKey(location.latitude, location.longitude, types);
  if (poiCache.has(key)) {
    return poiCache.get(key);
  }

  try {
    const response = await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location, types, radius, maxResults }),
    });

    if (!response.ok) {
      console.error(`Places proxy error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const places = data.places || [];
    poiCache.set(key, places);
    return places;
  } catch (error) {
    console.error("Places proxy error:", error);
    return [];
  }
}

/**
 * Search for POIs along a set of sample points (for route scoring).
 * Uses evenly spaced points so we sample the WHOLE route, not just the start.
 */
export async function searchAlongRoute(samplePoints, types) {
  const allPois = [];
  const seenIds = new Set();

  const maxQueries = 6;
  const pointsToQuery = evenlySpaced(samplePoints, maxQueries);

  for (const point of pointsToQuery) {
    const pois = await searchNearby(point, { types, radius: 200, maxResults: 5 });
    for (const poi of pois) {
      if (!seenIds.has(poi.id)) {
        seenIds.add(poi.id);
        allPois.push(poi);
      }
    }
  }

  return allPois;
}

function evenlySpaced(arr, n) {
  if (arr.length <= n) return arr;
  const step = (arr.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => arr[Math.round(i * step)]);
}

export function clearPOICache() {
  poiCache.clear();
}
