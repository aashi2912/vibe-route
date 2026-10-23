/**
 * Vercel Serverless Function — Google Places (New) proxy.
 *
 * Replaces the direct browser call in src/services/placesApi.js.
 * The REST key (GOOGLE_MAPS_SERVER_KEY) stays server-side.
 *
 * Request body: { location: {latitude, longitude}, types: string[],
 *                 radius?: number, maxResults?: number }
 * Response: { places: [...] }  (or { places: [], fallback, reason } on failure)
 */

import { originAllowed, getServerKey } from "./_googleGuard.js";

const PLACES_API_URL = "https://places.googleapis.com/v1/places:searchNearby";
const PLACES_FIELD_MASK =
  "places.displayName,places.types,places.rating,places.location,places.id";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!originAllowed(req)) {
    return res.status(403).json({ places: [], fallback: true, reason: "origin_blocked" });
  }

  const apiKey = getServerKey();
  if (!apiKey) {
    // Honest degradation: no key → no POIs, but the app still renders routes.
    return res.status(200).json({ places: [], fallback: true, reason: "no_key" });
  }

  try {
    const { location, types, radius = 200, maxResults = 5 } = req.body || {};
    if (!location || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
      return res.status(400).json({ error: "location {latitude, longitude} required" });
    }
    const includedTypes =
      Array.isArray(types) && types.length ? types : ["park", "cafe", "restaurant"];

    const response = await fetch(PLACES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: Math.min(Math.max(maxResults, 1), 20),
        locationRestriction: {
          circle: {
            center: { latitude: location.latitude, longitude: location.longitude },
            radius: Math.min(Math.max(radius, 1), 50000),
          },
        },
      }),
    });

    if (!response.ok) {
      console.error("Places API error:", response.status);
      return res.status(200).json({ places: [], fallback: true, reason: `upstream_${response.status}` });
    }

    const data = await response.json();
    const places = (data.places || []).map((p) => ({
      id: p.id,
      name: p.displayName?.text || "Unknown",
      types: p.types || [],
      rating: p.rating || null,
      location: p.location || null,
    }));

    return res.status(200).json({ places });
  } catch (error) {
    console.error("Places proxy error:", error);
    return res.status(200).json({ places: [], fallback: true, reason: "exception" });
  }
}
