/**
 * Client wrapper for walking routes.
 *
 * SECURITY: No longer calls Google directly. Calls our /api/routes proxy,
 * which holds the REST key server-side. No Google key in this file or bundle.
 *
 * Shape of mapped routes is unchanged, so downstream (orchestrator, scorer,
 * map rendering) needs no changes.
 */

function mapRoute(route, index) {
  return {
    id: `google-${index}`,
    source: "google-alternative",
    duration: route.duration,
    durationSeconds: parseInt(route.duration?.replace("s", "")) || 0,
    distanceMeters: route.distanceMeters,
    polylineEncoded: route.polyline?.encodedPolyline,
    labels: route.routeLabels || [],
    steps: route.legs?.[0]?.steps || [],
  };
}

async function callRoutesProxy(payload) {
  const response = await fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response;
}

/**
 * Fetch walking routes with alternatives.
 * Throws on hard failure so the UI can show an honest error state
 * (the orchestrator no longer has a silent-fail path for routing).
 */
export async function fetchWalkingRoutes(origin, destination) {
  const response = await callRoutesProxy({ mode: "alternatives", origin, destination });

  if (response.status === 503) {
    throw new Error("Routing is temporarily unavailable. Please try again shortly.");
  }
  if (!response.ok) {
    throw new Error(`Couldn't load walking routes (error ${response.status}). Please try again.`);
  }

  const data = await response.json();
  if (!data.routes || data.routes.length === 0) {
    throw new Error("No walking routes found between these locations.");
  }

  return data.routes.map(mapRoute);
}

/**
 * Fetch a single walking route via an intermediate waypoint.
 * Tries `via:true` first; the proxy returns the raw routes either way,
 * and we retry without `via` if the first attempt yields nothing.
 */
export async function fetchRouteViaWaypoint(origin, destination, waypoint) {
  let response = await callRoutesProxy({
    mode: "waypoint", origin, destination, waypoint, via: true,
  });

  let data = response.ok ? await response.json() : null;

  // Retry as a regular (non-via) intermediate if via produced nothing.
  if (!data || !data.routes || data.routes.length === 0) {
    console.warn("Via waypoint empty/failed, retrying as regular intermediate...");
    response = await callRoutesProxy({
      mode: "waypoint", origin, destination, waypoint, via: false,
    });
    if (!response.ok) {
      console.error("Regular waypoint route also failed");
      return null;
    }
    data = await response.json();
  }

  const route = data.routes?.[0];
  if (!route) return null;

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
