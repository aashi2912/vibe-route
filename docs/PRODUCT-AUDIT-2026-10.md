# From-Zero Product Audit — October 2026

Tested the live product against real geographies, distances, and edge cases
(routes + POIs pulled from prod, scored with the real engine). The goal was to
disprove "this is a finished, trustworthy product," not to confirm it. It isn't
finished. Findings below, worst first. Nothing here is cosmetic.

## Method
8 origin/destination pairs across dense core, suburb, two foreign cities, a small
town, and short/long/degenerate distances. For each: route count, pairwise route
overlap (how *different* the alternatives actually are), POIs found, vibe scores,
and per-vibe score spread across routes.

## 🔴 P0 — "Local Character" barely differentiates, and abroad the whole score set collapses
The headline promise is "routes scored by how they feel." The test says that
promise is weak exactly where it matters.
- **Toronto dense:** local spread across 3 routes = 0.4 (4.0–4.4). Every route is
  "very local." The signal can't tell them apart.
- **Paris:** green/coffee/local/lit spread = 0.1/0.2/0.0/0.0 — **all four scores
  identical across all three routes.** A user abroad sees three routes with the
  same scores and no reason to pick one.
- **Tokyo:** same collapse (spreads ≤0.2).
Root cause is structural, not a tuning nit: POI sampling caps at 5 results per
point × 6 points, and in any dense area every route hits that cap, so density-
based scores saturate identically. The k-recalibration (D-13) helped green/coffee
in Toronto but does not fix the cap-induced collapse, and does nothing abroad.
**This is the core value proposition failing its own test.** Fix: raise/remove the
per-point cap, score POIs the route actually passes (buffer the polyline) rather
than radius-sampling, and normalize scores *within the returned set* so the best
route always reads as distinct even when absolute densities are similar.

## 🔴 P0 — Degenerate input ships a broken screen
Origin == destination returns a route with `distanceMeters: null`. The UI renders
"NaNkm · NaN min" and a nonsensical scored route. The input-screen distance check
catches <500m but not the zero/degenerate case, and the results screen does no
guard. A user who fat-fingers the same place for both fields sees garbage. Fix:
reject distance ≈ 0 at input, and guard `distanceMeters == null` in the scorer and
cards (show a friendly message, not NaN).

## 🟠 P1 — Route "alternatives" are often the same walk
Max pairwise overlap: Paris 65%, Tokyo 61%, Toronto 56%, long-route 57%. Google's
alternatives frequently share most of their streets, and waypoint injection only
fires when overlap > 70% — so at 56–65% it never triggers, and the user gets three
near-identical routes presented as meaningful choices. The product's own
differentiator (waypoint injection) is gated too conservatively. Fix: lower the
overlap threshold, or always generate at least one waypoint-diverted option so
"3 routes" actually means 3 experiences.

## 🟠 P1 — Sparse/suburban areas: coffee≈0, little to score
Scarborough: coffee 0.4–0.6, few POIs, scores low across the board. Not a bug, but
the product has nothing useful to say outside walkable cores — and never tells the
user that. Fix: detect low-POI-density routes and set expectations ("quiet area —
limited vibe data") instead of showing confident low scores that look like a
verdict.

## 🟠 P1 — No analytics (confirmed)
Zero instrumentation. Can't see visits, funnel, vibe selection, drop-off, or
whether anyone uses the sample walk. Launching blind. (Being addressed.)

## 🟡 P2 — Trust & correctness smaller items
- **Scores are unexplained.** A user sees "Local 4.4" with no idea what drives it.
  No tooltip, no "why." For a judgment product, opacity undercuts trust.
- **No units/legend on the 0–5 scale** anywhere in the UI.
- **"Fastest" vs "+N min"** is computed per result set, fine — but ties aren't
  handled (two routes same duration both could read oddly).
- **Rating freshness / closed POIs** — Places ratings are shown without "hours" or
  open/closed state; a route past three closed cafes still scores high on coffee.
- **Lit is a proxy** (documented) but a user tapping it at night gets a number that
  looks authoritative; the proxy caveat is easy to miss.
- **No empty-state for "no POIs at all"** beyond the narrative fallback.

## 🟡 P2 — UX / trust gaps
- No way to **save, share, or revisit** a route (no deep link to a result).
- No **"recenter / my location"** — every session starts from typing an address;
  no geolocation ("walk from where I am").
- **Accessibility unaudited:** score bars encode meaning in color only; emoji-only
  signal columns have titles but the meters have no text alternative.
- **Reduced-motion** not respected on the score-bar fill animation.

## What is genuinely solid (so this is calibrated, not doom)
- Security model (post-fix), eval harness, honest AI scoping, grounded narratives
  (held up in live tests — named only real POIs), the redesigned UI, onboarding,
  and turn-by-turn all work as built. The *engineering* is senior-grade. The gaps
  above are **product/quality** gaps: the scoring doesn't yet deliver trustworthy
  differentiation, and a few inputs break. Those are the difference between "a
  demo that looks good" and "a product you'd trust to pick your walk."

## Honest verdict
Not yet "foolproof and genuinely useful." It is a strong, well-built demo with a
core-value problem: the scores it's selling don't reliably distinguish routes,
and they collapse entirely outside dense North American cores. Fix the two P0s and
the P1 route-diversity gate and it becomes genuinely useful. Ship the analytics so
the next round of decisions is data-driven, not guessed.
