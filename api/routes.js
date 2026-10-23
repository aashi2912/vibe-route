/**
 * Vercel Serverless Function — Google Routes v2 proxy.
 *
 * Replaces the direct browser calls in src/services/routesApi.js
 * (both the alternatives fetch and the waypoint-injected fetch).
 * The REST key (GOOGLE_MAPS_SERVER_KEY) stays server-side.
 *
 * Request body:
 *   { mode: "alternatives", origin, destination }
 *   { mode: "waypoint", origin, destination, waypoint, via?: boolean }
 * Response: { routes: [raw google route objects] }  — the client maps them.
 */

import { originAllowed, getServerKey } from "./_googleGuard.js";

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const ROUTES_FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.routeLabels",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.startLocation",
  "routes.legs.steps.endLocation",
  "routes.legs.steps.polyline.encodedPolyline",
].join(",");

function latLng(p) {
  return { location: { latLng: { latitude: p.latitude, longitude: p.longitude } } };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!originAllowed(req)) {
    return res.status(403).json({ error: "origin_blocked" });
  }

  const apiKey = getServerKey();
  if (!apiKey) {
    // Routes are load-bearing — no key means no product. Say so honestly.
    return res.status(503).json({ error: "routing_unavailable", reason: "no_key" });
  }

  try {
    const { mode = "alternatives", origin, destination, waypoint, via = true } = req.body || {};
    if (!origin || !destination) {
      return res.status(400).json({ error: "origin and destination required" });
    }

    const body = {
      origin: latLng(origin),
      destination: latLng(destination),
      travelMode: "WALK",
      languageCode: "en",
    };

    if (mode === "alternatives") {
      body.computeAlternativeRoutes = true;
    } else if (mode === "waypoint") {
      if (!waypoint) return res.status(400).json({ error: "waypoint required for mode=waypoint" });
      body.intermediates = [{ ...(via ? { via: true } : {}), ...latLng(waypoint) }];
    } else {
      return res.status(400).json({ error: `unknown mode: ${mode}` });
    }

    const response = await fetch(ROUTES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": ROUTES_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Routes API error:", response.status, text.slice(0, 200));
      return res.status(502).json({ error: "upstream_error", status: response.status });
    }

    const data = await response.json();
    return res.status(200).json({ routes: data.routes || [] });
  } catch (error) {
    console.error("Routes proxy error:", error);
    return res.status(500).json({ error: "exception" });
  }
}
