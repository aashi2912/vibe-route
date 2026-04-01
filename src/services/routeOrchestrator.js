import { fetchWalkingRoutes, fetchRouteViaWaypoint } from "./routesApi";
import { searchAlongRoute } from "./placesApi";
import { discoverWaypoints } from "./waypointEngine";
import { scoreRoute, rankRoutes } from "./vibeScorer";
import { generateNarrativesForRoutes } from "./narrativeGenerator";
import {
  decodePolyline,
  samplePointsAlongPolyline,
  calculateStreetOverlap,
} from "../utils/geo";
import {
  OVERLAP_THRESHOLD,
  POI_SAMPLE_INTERVAL_M,
  VIBES,
} from "../utils/constants";

/**
 * Route Orchestrator — the full pipeline.
 *
 * This is the core of Week 2. It connects all services:
 *
 * 1. Fetch Google's walking alternatives
 * 2. Check if alternatives are meaningfully different
 * 3. If too similar → discover waypoints and generate additional routes
 * 4. Score all routes by the user's selected vibes
 * 5. Rank and return
 *
 * Design decision: Progressive loading.
 * Routes appear on the map immediately (Step 1).
 * Scores load after (Steps 3-4) — this can take 3-5 seconds.
 * The UI shows routes first, then fills in scores.
 * This matches our Step 4 UX design.
 *
 * @param {Object} origin - { latitude, longitude }
 * @param {Object} destination - { latitude, longitude }
 * @param {string[]} selectedVibes - e.g. ["green", "coffee"]
 * @param {boolean} isNight - whether it's night time
 * @param {Function} onRoutesReady - callback when basic routes are ready (before scoring)
 * @param {Function} onScoringComplete - callback when vibe scores are computed
 * @param {Function} onNarrativesReady - callback when AI narratives are generated
 */
export async function orchestrateRoutes(
  origin,
  destination,
  selectedVibes,
  isNight,
  onRoutesReady,
  onScoringComplete,
  onNarrativesReady
) {
  // ============================================================
  // STEP 1: Fetch Google's walking alternatives
  // ============================================================
  let routes = await fetchWalkingRoutes(origin, destination);

  // Decode polylines for all routes (needed for map display + scoring)
  routes = routes.map((route) => ({
    ...route,
    decodedPolyline: route.polylineEncoded
      ? decodePolyline(route.polylineEncoded)
      : [],
  }));

  // Notify UI — routes are ready to display on map (no scores yet)
  if (onRoutesReady) {
    onRoutesReady(routes);
  }

  // ============================================================
  // STEP 2: Check route diversity
  // ============================================================
  let needsWaypoints = false;

  if (routes.length >= 2) {
    const defaultSteps = routes[0].steps || [];
    const altSteps = routes[1].steps || [];
    const overlap = calculateStreetOverlap(defaultSteps, altSteps);

    console.log(`Route overlap: ${(overlap * 100).toFixed(0)}% (threshold: ${OVERLAP_THRESHOLD * 100}%)`);

    if (overlap > OVERLAP_THRESHOLD) {
      needsWaypoints = true;
      console.log("Routes too similar — triggering waypoint injection");
    }
  } else {
    // Only 1 route returned — definitely need waypoints
    needsWaypoints = true;
  }

  // ============================================================
  // STEP 3: Discover waypoints and generate additional routes
  // ============================================================
  if (needsWaypoints) {
    try {
      const waypoints = await discoverWaypoints(origin, destination, 2);
      console.log(`Discovered ${waypoints.length} waypoint(s):`, waypoints.map(w => w.samplePOIs));

      for (const wp of waypoints) {
        try {
          const waypointRoute = await fetchRouteViaWaypoint(
            origin,
            destination,
            wp.center
          );

          if (waypointRoute) {
            // Decode its polyline
            waypointRoute.decodedPolyline = waypointRoute.polylineEncoded
              ? decodePolyline(waypointRoute.polylineEncoded)
              : [];

            // Give it a name based on the waypoint's POIs
            waypointRoute.waypointName =
              wp.samplePOIs?.[0] || "Discovered area";

            routes.push(waypointRoute);
          }
        } catch (err) {
          console.warn("Waypoint route failed:", err.message);
          // Continue — don't let one failed waypoint kill the whole flow
        }
      }

      // Limit to 4 routes total (map gets cluttered with more)
      routes = routes.slice(0, 4);

      // Notify UI again — routes updated with waypoint additions
      if (onRoutesReady) {
        onRoutesReady(routes);
      }
    } catch (err) {
      console.warn("Waypoint discovery failed:", err.message);
      // Continue with Google's original routes — scoring still works
    }
  }

  // ============================================================
  // STEP 4: Score all routes by vibes
  // ============================================================
  // Collect all place types we need to query based on selected vibes
  const relevantTypes = getRelevantPlaceTypes(selectedVibes);

  const scoredRoutes = [];

  for (const route of routes) {
    try {
      // Sample points along the route polyline
      const samplePoints = samplePointsAlongPolyline(
        route.decodedPolyline,
        POI_SAMPLE_INTERVAL_M
      );

      // Search for POIs near sample points
      const poisAlongRoute = await searchAlongRoute(samplePoints, relevantTypes);

      // Score the route
      const scores = scoreRoute(route, poisAlongRoute);

      scoredRoutes.push({
        ...route,
        scores,
        pois: poisAlongRoute,
        samplePointCount: samplePoints.length,
      });
    } catch (err) {
      console.warn(`Scoring failed for route ${route.id}:`, err.message);
      // Add route without scores rather than dropping it
      scoredRoutes.push({
        ...route,
        scores: { green: 0, coffee: 0, local: 0, lit: null },
        pois: [],
        samplePointCount: 0,
        scoringError: true,
      });
    }
  }

  // ============================================================
  // STEP 5: Rank by user's selected vibes
  // ============================================================
  const ranked = rankRoutes(scoredRoutes, selectedVibes);

  // ============================================================
  // STEP 6: Deduplicate POIs for display
  // ============================================================
  // Each route keeps ALL POIs for scoring (accurate numbers).
  // But for display (cards), we create a curated list:
  // - Prioritize POIs unique to this route
  // - Show diverse types (not 5 cafes)
  // - Max 6 per card
  const deduped = deduplicateDisplayPOIs(ranked);

  // Generate route names (with deduplication — no duplicate names)
  const usedNames = new Set();
  const namedRoutes = deduped.map((route, index) => {
    const name = generateRouteName(route, index, selectedVibes, usedNames);
    usedNames.add(name);
    return { ...route, name };
  });

  // Notify UI — scoring complete (no narratives yet)
  if (onScoringComplete) {
    onScoringComplete(namedRoutes);
  }

  // ============================================================
  // STEP 7: Generate AI narratives (async, non-blocking)
  // ============================================================
  try {
    const withNarratives = await generateNarrativesForRoutes(namedRoutes, isNight);
    if (onNarrativesReady) {
      onNarrativesReady(withNarratives);
    }
    return withNarratives;
  } catch (err) {
    console.warn("Narrative generation failed:", err.message);
    // Return routes without narratives — app still works
    return namedRoutes;
  }
}

/**
 * Get all Places API types we need to query based on the user's
 * selected vibes. Only query for what we need — saves API cost.
 */
function getRelevantPlaceTypes(selectedVibes) {
  const types = new Set();

  // Always include parks and cafes — they're cheap signals and broadly useful
  types.add("park");
  types.add("cafe");

  for (const vibeId of selectedVibes) {
    const vibe = VIBES.find((v) => v.id === vibeId);
    if (vibe?.placeTypes) {
      vibe.placeTypes.forEach((t) => types.add(t));
    }
  }

  // If local character is selected, add diverse types
  if (selectedVibes.includes("local")) {
    ["restaurant", "bakery", "book_store", "art_gallery", "museum"].forEach(
      (t) => types.add(t)
    );
  }

  return Array.from(types);
}

/**
 * Deduplicate POIs for display across routes.
 *
 * Problem: Routes that share geography show the same POIs.
 * Solution: For each route, create a curated display list that:
 * 1. Prioritizes POIs unique to this route (not on higher-ranked routes)
 * 2. Shows diverse types (1 cafe, 1 park, 1 restaurant — not 5 cafes)
 * 3. Caps at 6 per card
 *
 * Scoring POI counts are NOT affected — only display.
 */
function deduplicateDisplayPOIs(routes) {
  const claimedIds = new Set(); // POIs already shown on a higher-ranked route

  return routes.map((route) => {
    const pois = route.pois || [];

    // Split into unique (not claimed) and shared
    const unique = pois.filter((p) => !claimedIds.has(p.id));
    const shared = pois.filter((p) => claimedIds.has(p.id));

    // Pick display POIs: unique first, then shared as backfill
    // Prioritize type diversity
    const display = pickDiverse([...unique, ...shared], 6);

    // Claim unique POIs so lower-ranked routes won't show them
    for (const poi of unique) {
      claimedIds.add(poi.id);
    }

    return {
      ...route,
      displayPois: display,
    };
  });
}

/**
 * Pick N POIs with maximum type diversity.
 * Picks one of each type before repeating any type.
 */
function pickDiverse(pois, maxCount) {
  const picked = [];
  const usedPrimaryTypes = new Set();

  // First pass: one per primary type
  for (const poi of pois) {
    if (picked.length >= maxCount) break;
    const primaryType = getPrimaryType(poi.types);
    if (!usedPrimaryTypes.has(primaryType)) {
      usedPrimaryTypes.add(primaryType);
      picked.push(poi);
    }
  }

  // Second pass: fill remaining slots
  for (const poi of pois) {
    if (picked.length >= maxCount) break;
    if (!picked.includes(poi)) {
      picked.push(poi);
    }
  }

  return picked;
}

/**
 * Get the most specific/interesting type from a POI's type list.
 * Google returns many types per POI (e.g. ["cafe", "food", "establishment"]).
 * We want the most specific one.
 */
function getPrimaryType(types) {
  if (!types || types.length === 0) return "unknown";
  const generic = new Set([
    "point_of_interest", "establishment", "food", "store",
    "health", "finance", "lodging",
  ]);
  const specific = types.find((t) => !generic.has(t));
  return specific || types[0];
}

/**
 * Generate a human-readable route name based on its characteristics.
 *
 * Week 3 will replace this with AI-generated names.
 * For now, use a simple template approach.
 */
function generateRouteName(route, index, selectedVibes, usedNames) {
  // If it came from a waypoint, use the waypoint name
  if (route.waypointName) {
    const wpName = `Via ${route.waypointName}`;
    if (!usedNames.has(wpName)) return wpName;
  }

  // Find which vibe this route scores highest on
  const vibeScores = Object.entries(route.scores || {}).filter(
    ([key, val]) => val !== null && val > 0
  );

  if (vibeScores.length === 0) {
    return index === 0 ? "Direct Route" : `Route ${index + 1}`;
  }

  // Sort by score descending
  vibeScores.sort((a, b) => b[1] - a[1]);

  const nameMap = {
    green: ["The Park Path", "The Green Route", "The Quiet Walk"],
    coffee: ["The Coffee Route", "The Cafe Trail", "The Espresso Walk"],
    local: ["The Local Route", "The Neighbourhood Walk", "The Explorer's Path"],
    lit: ["The Bright Route", "The Well-Lit Walk"],
  };

  // Try each vibe in order of score, pick the first unused name
  for (const [vibeId] of vibeScores) {
    const candidates = nameMap[vibeId] || [`Route ${index + 1}`];
    for (const name of candidates) {
      if (!usedNames.has(name)) return name;
    }
  }

  // Check if this is the default/fastest route
  if (index === 0 && !usedNames.has("Direct Route")) {
    return "Direct Route";
  }

  return `Route ${index + 1}`;
}
