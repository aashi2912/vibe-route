# Vibe Route

**Walk the way that feels right.**

A walking-route comparison tool that scores routes by how they *feel* — greenery, coffee stops, local character, how well-lit they are — not just how fast they are.

**[Try it live →](https://vibe-route.vercel.app)**

---

## Why This Exists

Google Maps optimizes for speed. But pedestrian research consistently shows walkers accept longer routes when they're greener, safer, or more interesting.

In June 2024, a former Google Maps Senior UX Researcher [publicly explained](https://www.tomsguide.com/phones/google-pixel-phones/google-maps-may-not-offer-scenic-routes-because-it-could-be-too-biased) why Google won't add scenic routing — scoring routes on "niceness" would systematically bias toward affluent neighbourhoods. He confirmed the feature is "technically entirely feasible." The barrier is design, not engineering.

Vibe Route is my answer to that design challenge: score walking routes using objective, measurable signals instead of subjective "beauty," and let users define what matters to them.

---

## How It Works

```
User input → Routes API (alternatives) → overlap check → waypoint injection
→ Places API (POI scoring) → vibe scorer → LLM narratives → ranked display
```

1. User enters origin, destination, and vibe preferences — or describes their ideal walk in natural language.
2. Google Routes API returns walking alternatives; the system checks street overlap.
3. If alternatives overlap too much, a spatial-clustering step discovers POI-dense "vibe zones" and routes through them.
4. Each route is scored by querying parks, cafes, and other POIs along the polyline.
5. An LLM writes a 2–3 sentence narrative per route from verified POI data.
6. Routes are ranked by the user's selected vibes and shown with scores, narratives, and POI pills.

---

## What's actually AI here (and what isn't)

This is the honest breakdown. The product has four computational components, but they are not all "AI," and treating them as if they were would be marketing, not engineering.

| Component | What it really is | Evaluated how |
|---|---|---|
| **Natural-language vibe parsing** | **LLM** (Claude Haiku) — maps free text → vibe IDs | Classification eval, golden set — `evals/` |
| **Route narratives** | **LLM** (Claude Haiku) — describes a route from verified POI data | Groundedness eval (anti-hallucination) — `evals/` |
| **Waypoint discovery** | **Spatial clustering algorithm** (single-linkage, DBSCAN-family). Not a learned model. | Behavioural, via the pipeline |
| **Vibe scoring** | **Deterministic formula** — log-density of POIs per km. No model at all. | Unit test — `evals/scorer-sanity.test.js` |

Two of the four are genuine language-model features; both have a live eval harness. The other two are a classical algorithm and a formula. Being able to say which is which — and why the scorer is *not* and should not be an LLM — is the point.

### The two LLM features

**Natural-language input.** Type "quiet walk with a coffee stop" instead of tapping chips; an LLM parses it into structured vibe IDs. A small feature that demonstrates knowing *when* NLP earns its place (flexible input) versus when it doesn't (replacing a simple toggle).

**Route narratives.** Turns raw data (streets, POIs, scores) into a short, warm description. The prompt constrains the model to mention **only** POIs from verified Places data — an anti-hallucination design — and falls back to a template if the LLM is unavailable. The app works with the AI off.

### The two deterministic engines

**Waypoint discovery.** Google's walking alternatives often share most of their streets. A proximity-clustering pass over Places data finds POI-dense zones between origin and destination and generates genuinely different routes through them, capped at a 30% detour (from the Nanjing GPS study's ~25% leisure-walker tolerance). It's classical spatial clustering — honest to call it an algorithm, dishonest to call it a learned model.

**Vibe scoring.** Each route is scored 0–5 per vibe using a density curve `5 · (1 − e^(−density/k))` with diminishing returns, so a street with 3 cafes/km scores meaningfully differently from one with 8/km. This replaced an earlier linear formula that maxed every downtown route at 5.0. **Well-Lit** is scored as an honest *proxy* — main-road ratio plus night-business density — because no public API exposes real streetlight data. The limitation is stated in the UI, not hidden.

---

## Evaluating the AI

`evals/` is a small harness for the two features that are actually LLM calls.

```bash
npm run eval            # both suites, against deployed prod by default
npm run eval parse-vibes
npm run test:scorer     # deterministic scorer unit test
```

- **parse-vibes** — intent classification against a golden set (exact-match + F1).
- **narrative** — groundedness: every named place in a narrative must exist in the input POI list (deterministic detector + optional LLM-as-judge).
- **scorer-sanity** — a *unit test*, not an eval. The scorer is a formula; you test formulas, you don't run an LLM judge over them.

Latest live results and the honest story of a false-positive the harness surfaced in its own grader are in [`evals/RESULTS.md`](evals/RESULTS.md).

---

## Security — API keys

Two Google keys, by necessity:

- **Browser key** (`VITE_GOOGLE_MAPS_BROWSER_KEY`) — Maps JavaScript SDK only (map tiles + Places Autocomplete). It runs in the browser, so it must be restricted in Google Cloud to HTTP referrers + the Maps JS/Places APIs. It cannot be eliminated; the SDK runs client-side.
- **Server key** (`GOOGLE_MAPS_SERVER_KEY`) — Places (New) + Routes v2 REST, used **only** by the `api/places.js` and `api/routes.js` proxies. Never shipped to the browser.

The Anthropic key (`LLM_API_KEY`) is likewise server-only, used by `api/narrative.js` and `api/parse-vibes.js`.

> Earlier versions shipped a single Google key in the HTML and the JS bundle. If you are forking from old history, rotate that key.

---

## Tech Stack

React 18 + Vite · Google Maps Platform (Maps JS, Places New, Routes v2) · Anthropic Claude Haiku · Vercel serverless functions · Tailwind CSS

---

## Local Development

```bash
npm install
cp .env.example .env     # then fill in the three keys
npm run dev              # Vite dev server proxies /api/* locally
```

Required env vars (see `.env.example`):

```
VITE_GOOGLE_MAPS_BROWSER_KEY=   # browser — Maps JS SDK, referrer-locked
GOOGLE_MAPS_SERVER_KEY=         # server — Places + Routes REST
LLM_API_KEY=                    # server — Anthropic (narratives + parsing)
```

All three must also be set in Vercel's environment variables for production.

---

## Project Structure

```
api/              Serverless proxies (keys stay here, never in the browser)
  places.js         Google Places (New) proxy
  routes.js         Google Routes v2 proxy
  narrative.js      LLM narrative proxy
  parse-vibes.js    LLM vibe-parsing proxy
  _googleGuard.js   Shared origin-lock + server-key resolver
src/
  screens/        Input, Results, Detail
  services/       routesApi, placesApi, vibeScorer, waypointEngine,
                  narrativeGenerator, routeOrchestrator
  utils/          geo (polyline, haversine), constants (vibes, config)
evals/            Eval harness + golden sets + scorer unit test
```

---

## Status & Limitations

Shipped and live. Known, documented limitations:

- **Well-Lit is a proxy**, not measured lighting (no public streetlight API).
- **Road-type signals** are parsed from navigation-instruction text — a heuristic, not a road classification dataset.
- **Scores are relative** within a route set, not absolute across cities.
- A **bias audit** (correlating vibe scores with neighbourhood income) is designed but not yet run — see the decision log.

---

*Built by [Aashi Thakkar](https://aashithakkar.com) as a portfolio product.*
