# PRD Addendum — October 2026 Rebuild

Supplements *Vibe Route PRD v1.0 (April 2026)*. The v1.0 PRD stands as the
original record; this addendum captures what the hardening pass changed. Where
the two conflict, this addendum wins.

## 1. What changed and why

| Area | v1.0 said | Now | Reason |
|---|---|---|---|
| **Well-Lit vibe** | "Deferred (v2) — requires streetlight data" | **Shipped as a proxy** | Dead UI toggle fixed; proxy (main-road ratio + night-business density) is defensible and labelled. See DECISIONS D-11. |
| **API key handling** | Single Google key, client-side REST | **Two keys; Places/Routes proxied server-side** | P0 security fix. Key was exposed in bundle + public repo. See DECISIONS D-12. |
| **"AI components" framing** | "4 AI components" | **2 LLM features + 2 deterministic engines** | Honest breakdown; the count was inflated. See DECISIONS D-09. |
| **Evaluation** | Not specified | **Eval harness for the 2 LLM features; unit test for the scorer** | The AI-PM differentiator. See DECISIONS D-10. |

## 2. Revised feature specification — §4.2 Vibe Selection

| Vibe | Signals | Mechanism |
|---|---|---|
| Green & Peaceful | Parks + quiet-street ratio | Deterministic |
| Coffee Stops | Cafe density | Deterministic |
| Local Character | POI type diversity + density | Deterministic |
| **Well-Lit** | **Main-road ratio + night-business density** | **Deterministic proxy (not measured lighting)** |

Well-Lit is explicitly a proxy for "likely bright + busy," not a lux
measurement. Surfaced to the user via `proxyMessage` in the vibe picker.

## 3. New section — Evaluation & Quality

The two LLM features are evaluated against golden sets (`evals/`):

- **Vibe parsing** — intent classification, exact-match + F1. Threshold F1 ≥ 0.85.
- **Narratives** — groundedness (no POI invented outside the input list).
  Deterministic detector + optional LLM-as-judge. Threshold ≥ 0.90.

Latest live run (against production): parse-vibes 100% exact / F1 1.000;
narrative groundedness 100%. The deterministic scorer is covered by a unit
test, not an eval, by design (it's a formula, not a model).

## 4. New section — Security model

- **Browser key** — Maps JS SDK only; referrer- and API-restricted in Google Cloud.
- **Server key** — Places + Routes REST; proxied via `api/places.js`, `api/routes.js`; never in the client.
- **LLM key** — server-only; `api/narrative.js`, `api/parse-vibes.js`.

## 5. Open items (unchanged from v1.0, still open)

- **Bias audit** — correlate vibe scores with neighbourhood median income
  across ~50 Toronto routes; publish; adjust if correlation found. Designed,
  not yet executed.
- **Real lighting data** — replace the Well-Lit proxy with open streetlight
  datasets where available.
- **Street View Green View Index** (v2) — semantic segmentation for greenery
  actually visible at eye level (MIT Treepedia approach). Needs a backend.
