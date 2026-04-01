/**
 * Score a route on each vibe dimension based on POI data
 * and navigation instruction analysis.
 *
 * Each score is 0-5.
 *
 * v2 FIX: Switched from linear to density-based logarithmic formulas.
 * Linear formulas maxed out at 5.0 for every route in dense cities
 * (e.g. downtown Toronto: 77 POIs found, all routes scored 5.0).
 *
 * New approach: Score based on POI DENSITY (per km) with diminishing
 * returns. This differentiates routes in dense areas while still
 * rewarding routes in sparse areas.
 *
 * Formula: 5 * (1 - e^(-density / k))
 *   density = count / routeLengthKm
 *   k = controls how fast the curve saturates
 *   Higher k = harder to reach 5.0
 *
 * KNOWN LIMITATIONS:
 * - Road type heuristic is crude (checks instruction text for keywords).
 * - Well-Lit scoring is null in v1 (deferred).
 * - Scores are relative within a route set, not absolute.
 */

export function scoreRoute(route, poisAlongRoute) {
  const routeLengthKm = (route.distanceMeters || 1000) / 1000;

  return {
    green: scoreGreen(route, poisAlongRoute, routeLengthKm),
    coffee: scoreCoffee(poisAlongRoute, routeLengthKm),
    local: scoreLocal(poisAlongRoute, routeLengthKm),
    lit: null, // Deferred to v2
  };
}

/**
 * Logarithmic scoring curve with diminishing returns.
 * density=0 → 0, density=k → ~3.2, density=2k → ~4.3, density=5k → ~4.97
 */
function logScore(density, k) {
  const raw = 5 * (1 - Math.exp(-density / k));
  return Math.round(Math.min(5, Math.max(0, raw)) * 10) / 10;
}

// ============================================================
// GREEN & PEACEFUL
// ============================================================
// Combines: park density (parks per km) + quiet street ratio
//
// Parks within 200m of route, measured as density per km.
// k=1.5 means: 1 park/km ≈ 2.4, 2 parks/km ≈ 3.7, 3+ parks/km ≈ 4.3
// Quiet ratio adds up to 1.5 bonus points.

function scoreGreen(route, pois, routeLengthKm) {
  const parkCount = pois.filter((p) =>
    p.types?.some((t) => t === "park")
  ).length;

  const parkDensity = parkCount / routeLengthKm;
  const parkScore = logScore(parkDensity, 1.5);

  // Quiet street ratio bonus (0 to 1.5 points)
  const steps = route.steps || [];
  const totalSteps = steps.length || 1;
  const quietSteps = steps.filter((s) => {
    const instr = s.navigationInstruction?.instructions || "";
    return !instr.match(
      /\b(Ave|Avenue|Blvd|Boulevard|Highway|Expressway|Hwy)\b/i
    );
  }).length;
  const quietRatio = quietSteps / totalSteps;
  const quietBonus = quietRatio * 1.5;

  const raw = parkScore * 0.7 + quietBonus;
  return Math.round(Math.min(5, Math.max(0, raw)) * 10) / 10;
}

// ============================================================
// COFFEE STOPS
// ============================================================
// Cafe density (cafes per km) with diminishing returns.
// k=3 means: 1 cafe/km ≈ 1.4, 3/km ≈ 3.2, 5/km ≈ 4.1, 10/km ≈ 4.8
//
// Downtown Toronto has ~5-8 cafes/km on busy streets,
// ~1-2 cafes/km on residential streets.
// This should differentiate those.

function scoreCoffee(pois, routeLengthKm) {
  const cafeCount = pois.filter((p) =>
    p.types?.some((t) => t === "cafe" || t === "coffee_shop")
  ).length;

  const density = cafeCount / routeLengthKm;
  return logScore(density, 3);
}

// ============================================================
// LOCAL CHARACTER
// ============================================================
// Combines two signals:
// 1. Type diversity — how many DIFFERENT kinds of POIs (not just quantity)
//    Measured against a reasonable max of ~12 distinct types.
// 2. Density of "interesting" POIs (excludes generic types)
//
// This rewards a street with a cafe + bookstore + gallery + bakery
// over one with 10 restaurants and nothing else.

function scoreLocal(pois, routeLengthKm) {
  // Count distinct "interesting" types (filter out generic Google types)
  const interestingTypes = new Set();
  const genericTypes = new Set([
    "point_of_interest", "establishment", "food", "store",
    "health", "finance", "lodging", "place_of_worship",
  ]);

  for (const poi of pois) {
    for (const type of poi.types || []) {
      if (!genericTypes.has(type)) {
        interestingTypes.add(type);
      }
    }
  }

  // Diversity score: how many unique interesting types per km
  const diversityDensity = interestingTypes.size / routeLengthKm;
  const diversityScore = logScore(diversityDensity, 4);

  // Density of non-generic POIs per km
  const poiDensity = pois.length / routeLengthKm;
  const densityScore = logScore(poiDensity, 8);

  // Blend: diversity matters more than raw density
  const raw = diversityScore * 0.6 + densityScore * 0.4;
  return Math.round(Math.min(5, Math.max(0, raw)) * 10) / 10;
}

// ============================================================
// RANKING
// ============================================================

export function rankRoutes(routes, selectedVibes) {
  if (!selectedVibes.length) return routes;

  return [...routes]
    .map((route) => {
      const scores = selectedVibes
        .map((vibeId) => route.scores?.[vibeId] || 0);
      const weightedScore =
        scores.reduce((sum, s) => sum + s, 0) / scores.length;
      return { ...route, weightedScore };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);
}
