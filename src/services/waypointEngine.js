import { searchNearby } from "./placesApi";
import {
  pointsAlongLine,
  distanceBetween,
} from "../utils/geo";
import {
  MAX_DETOUR_RATIO,
  MIN_CLUSTER_SIZE,
  CLUSTER_RADIUS_M,
} from "../utils/constants";

/**
 * AI #4: Auto Waypoint Discovery
 *
 * Discovers "vibe zones" between origin and destination using
 * spatial clustering on Places API data.
 *
 * Algorithm:
 * 1. Sample 5 points along the corridor (straight line)
 * 2. Search for POIs near each point
 * 3. Cluster nearby POIs (simplified DBSCAN)
 * 4. Rank clusters by type diversity
 * 5. Filter by detour distance (max 30%)
 *
 * The 30% detour cap comes from the Nanjing GPS study:
 * leisure walkers accept ~25% longer paths. We add 5% margin.
 */

export async function discoverWaypoints(origin, destination, maxWaypoints = 2) {
  // 1. Sample corridor points
  const corridorPoints = pointsAlongLine(origin, destination, 5);

  // 2. Gather POIs along the corridor
  const allPOIs = [];
  const seenIds = new Set();

  for (const point of corridorPoints) {
    const pois = await searchNearby(point, {
      types: ["park", "cafe", "restaurant", "museum", "art_gallery", "book_store", "bakery"],
      radius: 500,
      maxResults: 10,
    });

    for (const poi of pois) {
      if (!seenIds.has(poi.id) && poi.location) {
        seenIds.add(poi.id);
        allPOIs.push(poi);
      }
    }
  }

  if (allPOIs.length < MIN_CLUSTER_SIZE) {
    // Not enough POIs to form clusters — sparse area
    return [];
  }

  // 3. Cluster POIs
  const clusters = clusterPOIs(allPOIs);

  // 4. Filter by detour distance
  const directDistance = distanceBetween(origin, destination);
  const validWaypoints = clusters.filter((c) => {
    const detour =
      distanceBetween(origin, c.center) +
      distanceBetween(c.center, destination);
    return detour < directDistance * MAX_DETOUR_RATIO;
  });

  // 5. Return top waypoints
  return validWaypoints.slice(0, maxWaypoints);
}

/**
 * Simplified DBSCAN-style clustering.
 *
 * Groups POIs that are within CLUSTER_RADIUS_M of each other.
 * Only keeps clusters with >= MIN_CLUSTER_SIZE POIs.
 * Ranks by type diversity (more diverse = more interesting vibe zone).
 *
 * Performance note: O(n²) distance comparison. Fine for n < 100 POIs.
 * For larger datasets, use an R-tree spatial index.
 */
function clusterPOIs(pois) {
  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < pois.length; i++) {
    if (visited.has(i)) continue;

    const cluster = [pois[i]];
    visited.add(i);

    for (let j = i + 1; j < pois.length; j++) {
      if (visited.has(j)) continue;
      if (!pois[i].location || !pois[j].location) continue;

      const dist = distanceBetween(pois[i].location, pois[j].location);
      if (dist < CLUSTER_RADIUS_M) {
        cluster.push(pois[j]);
        visited.add(j);
      }
    }

    if (cluster.length >= MIN_CLUSTER_SIZE) {
      const lats = cluster.map((p) => p.location.latitude);
      const lngs = cluster.map((p) => p.location.longitude);
      const allTypes = cluster.flatMap((p) => p.types || []);

      clusters.push({
        center: {
          latitude: lats.reduce((a, b) => a + b, 0) / lats.length,
          longitude: lngs.reduce((a, b) => a + b, 0) / lngs.length,
        },
        poiCount: cluster.length,
        uniqueTypes: new Set(allTypes).size,
        samplePOIs: cluster.slice(0, 3).map((p) => p.name),
      });
    }
  }

  // Sort by type diversity (most diverse first)
  return clusters.sort((a, b) => b.uniqueTypes - a.uniqueTypes);
}
