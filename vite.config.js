import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Shared helper: call Anthropic Claude API
  async function callClaude(apiKey, prompt, maxTokens = 250) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return null;
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  }

  // Shared helper: read POST body
  async function readBody(req) {
    let body = "";
    for await (const chunk of req) body += chunk;
    return body;
  }


  // Shared helper: call a Google REST endpoint with the server key
  async function callGoogle(url, fieldMask, body, apiKey) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("Google REST error:", r.status, t.slice(0, 200));
      return { ok: false, status: r.status };
    }
    return { ok: true, data: await r.json() };
  }

  const PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby";
  const PLACES_MASK = "places.displayName,places.types,places.rating,places.location,places.id";
  const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
  const ROUTES_MASK = [
    "routes.duration","routes.distanceMeters","routes.polyline.encodedPolyline",
    "routes.routeLabels","routes.legs.steps.navigationInstruction",
    "routes.legs.steps.startLocation","routes.legs.steps.endLocation",
    "routes.legs.steps.polyline.encodedPolyline",
  ].join(",");
  const serverKey = () => env.GOOGLE_MAPS_SERVER_KEY || env.VITE_GOOGLE_MAPS_KEY;

  return {
    plugins: [
      react(),
      {
        name: "api-proxy",
        configureServer(server) {
          // ─── /api/narrative ───────────────────────────
          server.middlewares.use("/api/narrative", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              return res.end(JSON.stringify({ error: "Method not allowed" }));
            }

            const apiKey = env.LLM_API_KEY;
            if (!apiKey || apiKey === "your_anthropic_api_key_here") {
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ narrative: null, fallback: true }));
            }

            try {
              const { prompt } = JSON.parse(await readBody(req));
              const narrative = await callClaude(apiKey, prompt);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ narrative }));
            } catch (err) {
              console.error("Narrative proxy error:", err);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ narrative: null, fallback: true }));
            }
          });

          // ─── /api/parse-vibes (AI #2: NLP Input) ─────
          server.middlewares.use("/api/parse-vibes", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              return res.end(JSON.stringify({ error: "Method not allowed" }));
            }

            const apiKey = env.LLM_API_KEY;
            if (!apiKey || apiKey === "your_anthropic_api_key_here") {
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ vibes: null, fallback: true }));
            }

            try {
              const { text } = JSON.parse(await readBody(req));

              const prompt = `You are a route preference parser. The user described their ideal walk. Extract which vibes they want from this list:
- "green" = parks, trees, nature, quiet, peaceful, greenery
- "coffee" = cafes, coffee shops, coffee stops
- "local" = local shops, restaurants, character, culture, neighbourhood, explore, food
- "lit" = well-lit, safe, bright, busy streets (for night walks)

User's description: "${text}"

Respond with ONLY a JSON array of matching vibe IDs. Examples:
- "I want a quiet walk through parks" → ["green"]
- "Find me coffee shops and local food" → ["coffee", "local"]
- "Safe well-lit route with greenery" → ["green", "lit"]
- "Just explore the neighbourhood" → ["local"]

If nothing matches clearly, return ["green", "local"] as defaults.

JSON array:`;

              const result = await callClaude(apiKey, prompt, 50);

              let vibes = null;
              if (result) {
                try {
                  // Extract JSON array from response
                  const match = result.match(/\[.*\]/s);
                  if (match) {
                    vibes = JSON.parse(match[0]);
                    // Validate — only allow known vibe IDs
                    const valid = ["green", "coffee", "local", "lit"];
                    vibes = vibes.filter((v) => valid.includes(v));
                    if (vibes.length === 0) vibes = ["green", "local"];
                  }
                } catch {
                  vibes = ["green", "local"];
                }
              }

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ vibes }));
            } catch (err) {
              console.error("Parse vibes error:", err);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ vibes: null, fallback: true }));
            }
          });

          // ─── /api/places (REST proxy, dev) ───────────
          server.middlewares.use("/api/places", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "Method not allowed" })); }
            const apiKey = serverKey();
            if (!apiKey) return res.end(JSON.stringify({ places: [], fallback: true, reason: "no_key" }));
            try {
              const { location, types, radius = 200, maxResults = 5 } = JSON.parse(await readBody(req));
              if (!location) { res.statusCode = 400; return res.end(JSON.stringify({ error: "location required" })); }
              const out = await callGoogle(PLACES_URL, PLACES_MASK, {
                includedTypes: (types && types.length) ? types : ["park","cafe","restaurant"],
                maxResultCount: Math.min(Math.max(maxResults,1),20),
                locationRestriction: { circle: { center: { latitude: location.latitude, longitude: location.longitude }, radius } },
              }, apiKey);
              if (!out.ok) return res.end(JSON.stringify({ places: [], fallback: true, reason: "upstream_" + out.status }));
              const places = (out.data.places || []).map((p) => ({ id: p.id, name: p.displayName?.text || "Unknown", types: p.types || [], rating: p.rating || null, location: p.location || null }));
              res.end(JSON.stringify({ places }));
            } catch (err) { console.error("places dev proxy error:", err); res.end(JSON.stringify({ places: [], fallback: true, reason: "exception" })); }
          });

          // ─── /api/routes (REST proxy, dev) ───────────
          server.middlewares.use("/api/routes", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "Method not allowed" })); }
            const apiKey = serverKey();
            if (!apiKey) { res.statusCode = 503; return res.end(JSON.stringify({ error: "routing_unavailable", reason: "no_key" })); }
            try {
              const { mode = "alternatives", origin, destination, waypoint, via = true } = JSON.parse(await readBody(req));
              if (!origin || !destination) { res.statusCode = 400; return res.end(JSON.stringify({ error: "origin and destination required" })); }
              const ll = (p) => ({ location: { latLng: { latitude: p.latitude, longitude: p.longitude } } });
              const body = { origin: ll(origin), destination: ll(destination), travelMode: "WALK", languageCode: "en" };
              if (mode === "alternatives") body.computeAlternativeRoutes = true;
              else if (mode === "waypoint") body.intermediates = [{ ...(via ? { via: true } : {}), ...ll(waypoint) }];
              const out = await callGoogle(ROUTES_URL, ROUTES_MASK, body, apiKey);
              if (!out.ok) { res.statusCode = 502; return res.end(JSON.stringify({ error: "upstream_error", status: out.status })); }
              res.end(JSON.stringify({ routes: out.data.routes || [] }));
            } catch (err) { console.error("routes dev proxy error:", err); res.statusCode = 500; res.end(JSON.stringify({ error: "exception" })); }
          });
        },
      },
    ],
  };
});
