/**
 * AI #3: LLM Route Narrative Generator
 *
 * Generates human-readable descriptions of walking routes
 * by calling the Anthropic Claude API via a server-side proxy.
 *
 * Anti-hallucination design:
 * - Prompt explicitly constrains the LLM to ONLY mention POIs from our data
 * - All facts (distance, streets, POI names) come from verified API responses
 * - LLM just assembles them into natural language
 *
 * Fallback design:
 * - If LLM API is unavailable, returns a template-based description
 * - The app MUST work without the AI narrative
 */

/**
 * Generate a narrative for a single route.
 *
 * @param {Object} routeData - Must contain:
 *   - streets: string[] — street names from navigation instructions
 *   - pois: Object[] — POIs with name and type
 *   - scores: Object — { green, coffee, local }
 *   - durationSeconds: number
 *   - distanceMeters: number
 *   - isNight: boolean
 */
export async function generateNarrative(routeData) {
  const prompt = buildPrompt(routeData);

  try {
    const response = await fetch("/api/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      console.warn("Narrative API returned", response.status);
      return fallbackNarrative(routeData);
    }

    const data = await response.json();

    if (!data.narrative || data.fallback) {
      return fallbackNarrative(routeData);
    }

    return data.narrative;
  } catch (err) {
    console.warn("Narrative generation failed:", err.message);
    return fallbackNarrative(routeData);
  }
}

/**
 * Generate narratives for multiple routes in parallel.
 * Returns routes with a `narrative` field added.
 */
export async function generateNarrativesForRoutes(routes, isNight) {
  const results = await Promise.allSettled(
    routes.map((route) => {
      const routeData = buildRouteData(route, isNight);
      return generateNarrative(routeData);
    })
  );

  return routes.map((route, i) => ({
    ...route,
    narrative:
      results[i].status === "fulfilled"
        ? results[i].value
        : fallbackNarrative(buildRouteData(route, isNight)),
  }));
}

/**
 * Build structured route data for the prompt.
 */
function buildRouteData(route, isNight) {
  // Extract street names from navigation instructions
  const streets = (route.steps || [])
    .map((s) => {
      const instr = s.navigationInstruction?.instructions || "";
      // Extract street name from "Turn left onto Queen St W"
      const match = instr.match(/onto\s+(.+)$/i) || instr.match(/on\s+(.+)$/i);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    // Deduplicate consecutive streets
    .filter((street, i, arr) => i === 0 || street !== arr[i - 1]);

  return {
    streets,
    pois: (route.displayPois || route.pois || []).slice(0, 8),
    scores: route.scores || {},
    durationSeconds: route.durationSeconds || 0,
    distanceMeters: route.distanceMeters || 0,
    isNight: isNight || false,
  };
}

/**
 * Build the anti-hallucination prompt.
 *
 * Key design decisions:
 * 1. "ONLY mention places from the POI list" — prevents inventing businesses
 * 2. All data is from verified API responses — LLM just describes, doesn't guess
 * 3. Short (2-3 sentences) — less room for hallucination
 * 4. Warm tone — matches the product's "feeling" not "efficiency" positioning
 */
function buildPrompt(routeData) {
  const minutes = Math.round(routeData.durationSeconds / 60);
  const km = (routeData.distanceMeters / 1000).toFixed(1);
  const streetList = routeData.streets.slice(0, 6).join(" → ");
  const poiList = routeData.pois
    .map((p) => `${p.name} (${getPrimaryType(p.types)})`)
    .join(", ");

  const topVibe = getTopVibe(routeData.scores);

  return `Describe this walking route in exactly 2-3 sentences for someone deciding which way to walk.

RULES:
- ONLY mention places from the POI list below. Do NOT invent any locations.
- Be specific about the feel and character of the walk.
- Keep it warm and helpful, like a friend who knows the neighbourhood.
- Mention the strongest vibe quality naturally (don't say "score" or "rating").
- ${routeData.isNight ? "It's evening/night — mention anything relevant to walking after dark." : "It's daytime."}

ROUTE DATA:
- Distance: ${km} km (~${minutes} min walk)
- Streets: ${streetList || "various local streets"}
- POIs along route: ${poiList || "none found nearby"}
- Strongest quality: ${topVibe}
- Green score: ${routeData.scores.green?.toFixed(1) || "0"}/5
- Coffee score: ${routeData.scores.coffee?.toFixed(1) || "0"}/5
- Local character score: ${routeData.scores.local?.toFixed(1) || "0"}/5

Write the 2-3 sentence description:`;
}

/**
 * Fallback narrative — no AI needed.
 * Used when LLM API is unavailable or unconfigured.
 */
function fallbackNarrative(routeData) {
  const minutes = Math.round((routeData.durationSeconds || 0) / 60);
  const streets = routeData.streets || [];
  const pois = routeData.pois || [];

  const streetText =
    streets.length > 2
      ? `${streets.slice(0, 2).join(", ")} and ${streets[streets.length - 1]}`
      : streets.length > 0
      ? streets.join(" and ")
      : null;

  const topVibe = getTopVibe(routeData.scores);
  const topPOI = pois[0]?.name;

  let desc = `A ${minutes}-minute walk`;
  if (streetText) desc += ` via ${streetText}`;
  desc += ".";

  if (topVibe && topVibe !== "balanced") {
    const vibeDescs = {
      green: "Relatively green and peaceful",
      coffee: "Good for coffee stops",
      local: "Rich in local character",
    };
    desc += ` ${vibeDescs[topVibe] || "A solid route"}.`;
  }

  if (topPOI) {
    desc += ` Passes ${topPOI}${pois.length > 1 ? ` and ${pois.length - 1} other spot${pois.length > 2 ? "s" : ""}` : ""}.`;
  }

  return desc;
}

function getTopVibe(scores) {
  if (!scores) return "balanced";
  const entries = Object.entries(scores).filter(
    ([k, v]) => v !== null && v > 0
  );
  if (entries.length === 0) return "balanced";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function getPrimaryType(types) {
  if (!types || types.length === 0) return "place";
  const generic = new Set([
    "point_of_interest", "establishment", "food", "store",
  ]);
  return types.find((t) => !generic.has(t)) || types[0];
}
