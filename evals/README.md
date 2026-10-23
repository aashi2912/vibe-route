# Vibe Route — Eval Harness

A small, honest evaluation harness for the **two features that are actually
LLM calls**: natural-language vibe parsing (`/api/parse-vibes`) and route
narrative generation (`/api/narrative`).

## Why only these two

Vibe Route has three "AI" touchpoints. Only two are language-model calls:

| Feature | What it is | Evaluated here? |
|---|---|---|
| Vibe **parsing** | LLM maps free text → vibe IDs | ✅ classification eval |
| Route **narrative** | LLM writes route descriptions | ✅ groundedness eval |
| Vibe **scoring** | Deterministic log-density formula | ❌ — it's math, not a model |

**The scorer is deliberately not in this harness.** You evaluate models, not
formulas. A formula's output is a direct function of its inputs — you unit-test
it, you don't run an LLM-as-judge over it. Bolting an "AI eval" onto
`vibeScorer.js` would be theater. Being clear about that line is the point.

(The scorer *does* have its own correctness check — see `scorer-sanity.test.js`:
density inputs → expected score bands. That's a unit test, not an eval.)

## What each eval measures

### 1. parse-vibes — intent accuracy
Golden set of `(description → expected vibe set)`. Scored on:
- **Exact match** — predicted set == expected set
- **F1** — partial credit (precision/recall over vibe IDs)

Catches silent regressions when the prompt or model changes (e.g. "safe
well-lit route with trees" quietly dropping `lit`).

### 2. narrative — groundedness (anti-hallucination)
The narrative prompt claims it "will ONLY mention places from the POI list."
This eval checks whether that holds. For each case:
- **Deterministic pass** — every proper-noun place mention in the narrative
  must appear in the input POI list. Any invented name = hallucination.
- **LLM-as-judge pass** — a second model rates groundedness 1–5 and flags
  unsupported claims the string match misses (paraphrased inventions).

A route narrative that invents "the charming Blue Door Café" when no such POI
was in the data is the exact failure this catches — the one that erodes trust.

## Run

```bash
# Needs LLM_API_KEY in env (same key the app uses).
node evals/run.js                 # both suites
node evals/run.js parse-vibes     # one suite
node evals/run.js narrative
```

Exit code is non-zero if any suite falls below its threshold (parse-vibes F1
≥ 0.85, narrative groundedness ≥ 0.90), so this can gate a deploy in CI.

## Files
- `run.js` — runner, scoring, thresholds, report
- `cases/parse-vibes.json` — golden set for intent parsing
- `cases/narrative.json` — golden set for narrative groundedness
- `scorer-sanity.test.js` — unit test for the deterministic scorer
