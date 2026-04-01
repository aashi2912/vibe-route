// ============================================================
// VIBE DEFINITIONS
// ============================================================
// Each vibe maps to specific Places API types and scoring logic.
// Order matters — first vibe in user's selection is the primary sort.

export const VIBES = [
  {
    id: "green",
    icon: "🌳",
    label: "Green & Peaceful",
    description: "Parks, trees, quiet streets",
    // Places API types used for scoring this vibe
    placeTypes: ["park"],
    // Color for UI elements related to this vibe
    color: "#2d6a4f",
  },
  {
    id: "lit",
    icon: "🔦",
    label: "Well-Lit",
    description: "Bright streets, open businesses",
    placeTypes: [], // v2 — uses streetlight data, not Places API
    color: "#eab308",
    // Flag that this vibe has limited functionality in v1
    v1Limited: true,
    v1Message: "Detailed lighting data coming soon. Currently estimates based on nearby open businesses.",
  },
  {
    id: "coffee",
    icon: "☕",
    label: "Coffee Stops",
    description: "Cafes along the way",
    placeTypes: ["cafe", "coffee_shop"],
    color: "#92400e",
  },
  {
    id: "local",
    icon: "🏘️",
    label: "Local Character",
    description: "Diverse shops, food, culture",
    placeTypes: ["restaurant", "bakery", "book_store", "art_gallery", "museum"],
    color: "#e07a2f",
  },
];

// ============================================================
// ROUTE COLORS
// ============================================================
// Distinct colors for up to 4 routes on the map.
// Chosen for accessibility — distinguishable for most color vision types.

export const ROUTE_COLORS = ["#2d6a4f", "#e07a2f", "#5a67d8", "#dc2626"];

// ============================================================
// API CONFIG
// ============================================================

export const ROUTES_API_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

export const PLACES_API_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

// Field mask for Routes API — request ONLY what we need.
// Reduces cost and latency per Google docs.
export const ROUTES_FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.routeLabels",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.startLocation",
  "routes.legs.steps.endLocation",
  "routes.legs.steps.polyline.encodedPolyline",
].join(",");

// Field mask for Places Nearby Search
export const PLACES_FIELD_MASK =
  "places.displayName,places.types,places.rating,places.location,places.id";

// ============================================================
// SCORING CONFIG
// ============================================================

// Maximum detour ratio for waypoint injection
// Based on: Nanjing GPS study found ~25% detour tolerance for leisure walkers
// We add 5% margin → 30%
export const MAX_DETOUR_RATIO = 1.3;

// Minimum POIs in a cluster to qualify as a "vibe zone"
export const MIN_CLUSTER_SIZE = 3;

// Cluster radius in meters for waypoint discovery
export const CLUSTER_RADIUS_M = 200;

// How often to sample points along a polyline for POI scoring (meters)
export const POI_SAMPLE_INTERVAL_M = 400;

// Search radius around each sample point for POIs (meters)
export const POI_SEARCH_RADIUS_M = 200;

// Street overlap threshold — if alternatives overlap more than this,
// trigger waypoint injection. Based on our API test results:
// 2/6 routes had 100% overlap, 2/6 had 40-50%, 2/6 had 22-67%.
export const OVERLAP_THRESHOLD = 0.7;

// ============================================================
// UI CONFIG
// ============================================================

export const MAX_VIBE_SELECTIONS = 3;
export const MAX_WALKING_DISTANCE_M = 10000; // 10km
export const MIN_WALKING_DISTANCE_M = 500; // 500m
