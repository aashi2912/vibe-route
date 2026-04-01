import { PLACES_API_URL, PLACES_FIELD_MASK } from "../utils/constants";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

/**
 * Search for nearby places using Google Places API (New).
 *
 * Endpoint: POST places.googleapis.com/v1/places:searchNearby
 * Verified against Google Places API (New) docs, March 2026.
 *
 * Cost: varies by SKU — Nearby Search is in the "Pro" tier.
 * We minimize calls by sampling route points every 400m
 * and caching results for repeated queries.
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

  // Check cache first
  const key = cacheKey(location.latitude, location.longitude, types);
  if (poiCache.has(key)) {
    return poiCache.get(key);
  }

  if (!API_KEY) {
    console.warn("No API key — returning empty POI results");
    return [];
  }

  try {
    const response = await fetch(PLACES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: types,
        maxResultCount: maxResults,
        locationRestriction: {
          circle: {
            center: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
            radius: radius,
          },
        },
      }),
    });

    if (!response.ok) {
      console.error(`Places API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const places = (data.places || []).map((p) => ({
      id: p.id,
      name: p.displayName?.text || "Unknown",
      types: p.types || [],
      rating: p.rating || null,
      location: p.location || null,
    }));

    // Cache the result
    poiCache.set(key, places);

    return places;
  } catch (error) {
    console.error("Places API error:", error);
    return [];
  }
}

/**
 * Search for POIs along a set of sample points.
 * Used for: scoring a route's vibe.
 *
 * Takes sample points (from samplePointsAlongPolyline) and
 * queries for relevant POIs near each one.
 *
 * Returns a flat array of all unique POIs found along the route.
 */
export async function searchAlongRoute(samplePoints, types) {
  const allPois = [];
  const seenIds = new Set();

  // Use evenly spaced points, not just the first N.
  // This ensures we sample the WHOLE route, not just the start.
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

/**
 * Pick N evenly spaced items from an array.
 * Ensures we sample the full length, not just the beginning.
 */
function evenlySpaced(arr, n) {
  if (arr.length <= n) return arr;
  const step = (arr.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => arr[Math.round(i * step)]);
}

/**
 * Clear the POI cache.
 * Call this if the user changes location significantly.
 */
export function clearPOICache() {
  poiCache.clear();
}
