# Eval Results

Run against **live production** (`https://vibe-route.vercel.app`) on 2026-10-22.
Mode: `endpoint` (tests the deployed app, not a local reimplementation).

## parse-vibes — intent accuracy
- 15 cases · **exact-match 100%** · **avg F1 1.000** · threshold 0.85 → **PASS**
- Covers clean single intents, multi-vibe, ambiguous phrasing, the "lit gets
  dropped" regression risk (pv-09), and the garbage→default case (pv-14).

## narrative — groundedness (anti-hallucination)
- 5 cases · **groundedness 100%** · threshold 0.90 → **PASS**
- Includes the empty-POI trap (nr-05): with zero POIs supplied, the model
  named zero places. No hallucinated venues in any case.

## scorer-sanity — deterministic unit test
- 11 assertions · **PASS**
- Confirms the log curve differentiates realistic densities (2 vs 7 cafes/km),
  caps at 5.0 only at unrealistic extremes, and that lit/green pull apart.

## What the harness caught (the honest part)
The first version of the groundedness detector flagged **street names** as
hallucinated POIs → a false 0%. The narratives were fine; the *grader* was
wrong. Fix: exclude the route's own street list + street-suffix tokens before
counting a mention as invented. Lesson carried into the case study: a naive
automated grader manufactures false failures — validate the grader before you
trust its verdict. The scorer unit test also corrected an over-claim in the
scorer's own comments ("never maxes out" — it rounds to 5.0 at ~15 cafes/km).
