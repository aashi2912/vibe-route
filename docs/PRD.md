# Vibe Route — Product Requirements Document (v2)

**Author:** Aashi Thakkar · **Status:** Shipped & hardened · **Surface:** Responsive web
**Live:** vibe-route.vercel.app · **Updated:** October 2026
*(v2 supersedes the April 2026 PRD v1.0 and folds in the Oct-2026 rebuild. Where they differ, this wins.)*

## 1. Overview
Vibe Route helps people choose a walking route by how it *feels* — greenery, coffee, local character, how well-lit it is — not only by which is fastest. You enter a start and destination, pick the signals that matter (or describe the walk in plain words), and get real walking routes compared and narrated, each scored on your signals.

Google Maps optimizes for speed. Vibe Route optimizes for experience, using objective, measurable signals rather than a subjective notion of "nice."

## 2. Problem
Walking navigation treats every route as a distance-minimization problem. A quiet path through a park and a loud arterial are "equal" if they take the same time. For leisure walkers, neighbourhood explorers, and people walking after dark, the character of the route matters more than the minutes saved. A former Google Maps researcher noted scenic routing is technically feasible but risks encoding socioeconomic bias — so mainstream maps don't ship it. That bias risk is a design constraint, not a reason not to build.

## 3. Target users
- **The Leisure Walker** (primary) — walks for enjoyment; cares about greenery, quiet, interesting streets.
- **The Neighbourhood Explorer** — new to a city; wants local character, cafes, landmarks on foot.
- **The Night Walker** — walks after dark; prioritizes bright, populated routes (safety through environmental design).
- **Secondary (portfolio):** reviewers evaluating AI product judgment.

## 4. What is — and isn't — AI (the honest architecture)
Four computational components. Only two are language-model features; the product does not dress up the other two as "AI."

| Component | What it really is | How it's assured |
|---|---|---|
| Natural-language vibe parsing | **LLM** (Claude Haiku) — free text → vibe IDs | Classification eval (golden set, exact-match + F1) |
| Route narratives | **LLM** (Claude Haiku) — describes a route from verified POIs | Groundedness eval (anti-hallucination) |
| Waypoint discovery | **Spatial clustering algorithm** (single-linkage, DBSCAN-family) — not a learned model | Behavioural, through the pipeline |
| Vibe scoring | **Deterministic formula** — log-density of POIs per km | Unit test (not an LLM eval) |

Being able to say which is which — and why the scorer should *not* be an LLM — is the core judgment claim.

## 5. Feature spec

### 5.1 Input
Google Places Autocomplete for start/destination (lat/lng directly, no separate geocode), plus a one-tap **"Use my location"** and a **sample walk** for zero-effort trial.

### 5.2 Vibe selection (up to 3)
| Vibe | Signals | Mechanism |
|---|---|---|
| Green & Peaceful | parks + quiet-street ratio | deterministic |
| Coffee Stops | cafe density | deterministic |
| Local Character | POI type diversity + interesting-POI density | deterministic |
| **Well-Lit** | main-road ratio + night-business density | **deterministic proxy — not measured lighting (shipped, honestly labelled)** |

Or describe the walk in natural language; an LLM maps it to the signals.

### 5.3 Route generation (3–5 routes)
Google Routes alternatives, plus **waypoint injection** when alternatives overlap too much (threshold 0.5, tuned after real-world testing showed 55–65% overlap), so the user gets genuinely different walks. Detour capped at ~30% (Nanjing GPS leisure-walker tolerance).

### 5.4 Scoring & ranking
Each route scored 0–5 per vibe via `5·(1−e^(−density/k))` (diminishing returns; replaced a linear version that maxed every dense route at 5.0). Routes ranked by the user's selected vibes. Each selected vibe's top route is tagged **"best for"** so the user has a decision basis even when absolute scores are close.

### 5.5 Narratives
LLM writes 2–3 sentences per route, constrained to verified POIs (anti-hallucination), with a template fallback. The app works with AI off.

### 5.6 Navigation
In-app turn-by-turn preview (from the route's own step data — not live GPS), proper screen flow, and an honest Google Maps handoff that carries the chosen route's waypoint for live GPS.

### 5.7 Onboarding
First-run welcome + an interactive guided tour that spotlights each real control, plus a replayable "How it works" link.

## 6. Security
Two Google keys: a referrer-locked **browser key** (Maps JS SDK only) and a server-only **REST key** (Places + Routes) behind `api/places.js` / `api/routes.js`. The Anthropic key is server-only. (A prior build shipped one key in the bundle; that class of bug is fixed and documented.)

## 7. Evaluation & quality
`evals/` harness for the two LLM features: parse-vibes (intent, F1) and narrative (groundedness). Live: 100% exact / F1 1.000 and 100% grounded. The scorer has a unit test, not an eval. A from-zero product audit (docs/PRODUCT-AUDIT) stress-tested across cities and drove the route-diversity + degenerate-input fixes.

## 8. Success metrics
North Star: **routes selected / opened in Maps.**
- **Activation:** visitor → routes generated
- **Aha:** visitor → route selected
- **Share rate**, **Day-3 retention**, **channel attribution**
Instrumented with PostHog (product-tagged to share a project cleanly); a live `/metrics` dashboard reads it server-side and shows the funnel beside the real eval-quality numbers. Starts honest (no fabricated numbers).

## 9. Known limitations (stated, not hidden)
- **Well-Lit is a proxy**, not measured lighting (no public streetlight API).
- **Scores compress** where routes share geography (dense cores, some cities) — the answer is route diversity, not fudged scores; the "best for" label covers the decision.
- **Sparse areas** have little to score; the UI says so rather than showing a confident low verdict.
- **Bias audit** (score vs. neighbourhood income) is designed, not yet run.

## 10. Roadmap
- Real streetlight data to replace the Well-Lit proxy.
- Street View Green View Index (semantic segmentation) for greenery actually visible at eye level.
- Run and publish the bias audit.
- Community layer (user-submitted vibes) — gated on moderation/privacy thinking.
