import { ROUTES_API_URL, ROUTES_FIELD_MASK } from "../utils/constants";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

/**
 * Fetch walking routes with alternatives from Google Routes API.
 *
 * Endpoint: POST routes.googleapis.com/directions/v2:computeRoutes
 * Verified against: developers.google.com/maps/documentation/routes
 * Last verified: March 2026
 *
 * Returns up to 3 alternatives alongside the default route.
 * Alternatives are NOT guaranteed — Google returns them when available.
 * Our API test showed 6/6 routes returned at least 1 alternative.
 */
export async function fetchWalkingRoutes(origin, destination) {
  if (!API_KEY || API_KEY === "your_google_maps_api_key_here") {
    throw new Error(
      "Google Maps API key not configured. Add VITE_GOOGLE_MAPS_KEY to .env"
    );
  }

  const response = await fetch(ROUTES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": ROUTES_FIELD_MASK,
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: { latitude: origin.latitude, longitude: origin.longitude },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        },
      },
      travelMode: "WALK",
      computeAlternativeRoutes: true,
      languageCode: "en",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Routes API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error("No walking routes found between these locations.");
  }

  return data.routes.map((route, index) => ({
    id: `google-${index}`,
    source: "google-alternative",
    duration: route.duration,
    durationSeconds: parseInt(route.duration?.replace("s", "")) || 0,
    distanceMeters: route.distanceMeters,
    polylineEncoded: route.polyline?.encodedPolyline,
    labels: route.routeLabels || [],
    steps: route.legs?.[0]?.steps || [],
  }));
}

/**
 * Fetch a single walking route via an intermediate waypoint.
 * Forces the route through a specific "vibe zone."
 *
 * Uses `via: true` for a passthrough waypoint (no stop).
 *
 * CAVEAT: `via: true` is confirmed for DRIVE mode in Google docs.
 * For WALK mode, it needs testing. If it fails, fall back to
 * a regular intermediate waypoint (creates a 2-leg route instead
 * of a 1-leg route — functionally equivalent for our purposes).
 */
export async function fetchRouteViaWaypoint(origin, destination, waypoint) {
  if (!API_KEY) {
    throw new Error("Google Maps API key not configured.");
  }

  const response = await fetch(ROUTES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": ROUTES_FIELD_MASK,
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: { latitude: origin.latitude, longitude: origin.longitude },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        },
      },
      intermediates: [
        {
          via: true,
          location: {
            latLng: {
              latitude: waypoint.latitude,
              longitude: waypoint.longitude,
            },
          },
        },
      ],
      travelMode: "WALK",
      languageCode: "en",
    }),
  });

  if (!response.ok) {
    // If via:true fails for WALK, retry without via (regular waypoint)
    console.warn("Via waypoint failed, retrying as regular intermediate...");
    return fetchRouteViaRegularWaypoint(origin, destination, waypoint);
  }

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    return null;
  }

  const route = data.routes[0];
  // For via routes, all steps are in a single leg
  const allSteps = route.legs?.flatMap((leg) => leg.steps || []) || [];

  return {
    id: `waypoint-${waypoint.latitude.toFixed(4)}`,
    source: "waypoint-injected",
    duration: route.duration,
    durationSeconds: parseInt(route.duration?.replace("s", "")) || 0,
    distanceMeters: route.distanceMeters,
    polylineEncoded: route.polyline?.encodedPolyline,
    labels: ["WAYPOINT_ROUTE"],
    steps: allSteps,
    waypointUsed: waypoint,
  };
}

/**
 * Fallback: fetch route with regular intermediate waypoint.
 * Creates a 2-leg route (origin→waypoint, waypoint→destination).
 * Used if via:true doesn't work for WALK mode.
 */
async function fetchRouteViaRegularWaypoint(origin, destination, waypoint) {
  const response = await fetch(ROUTES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": ROUTES_FIELD_MASK,
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: { latitude: origin.latitude, longitude: origin.longitude },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        },
      },
      intermediates: [
        {
          location: {
            latLng: {
              latitude: waypoint.latitude,
              longitude: waypoint.longitude,
            },
          },
        },
      ],
      travelMode: "WALK",
      languageCode: "en",
    }),
  });

  if (!response.ok) {
    console.error("Regular waypoint route also failed");
    return null;
  }

  const data = await response.json();
  if (!data.routes?.[0]) return null;

  const route = data.routes[0];
  const allSteps = route.legs?.flatMap((leg) => leg.steps || []) || [];

  return {
    id: `waypoint-${waypoint.latitude.toFixed(4)}`,
    source: "waypoint-injected",
    duration: route.duration,
    durationSeconds: parseInt(route.duration?.replace("s", "")) || 0,
    distanceMeters: route.distanceMeters,
    polylineEncoded: route.polyline?.encodedPolyline,
    labels: ["WAYPOINT_ROUTE"],
    steps: allSteps,
    waypointUsed: waypoint,
  };
}
