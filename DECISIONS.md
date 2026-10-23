# Decision Log — Vibe Route

Chronological record of the decisions that shaped the product, with the
tradeoff and the reasoning. Newer entries first. The point of this log is not
that every call was right — it's that each was *made*, not defaulted into.

---

## 2026-10 — Rebuild / hardening pass

### D-14 · Name routes by the user's selected vibes, not absolute scores
**Decision.** `generateRouteName` now ranks the *selected* vibes by this route's
score on them; it only falls back to all vibes if the route has zero signal on
any selected one.
**Why.** A "Green & Peaceful" search was producing routes named "The Coffee
Route / Cafe Trail / Espresso Walk" — because the old logic named by whichever
vibe scored highest in absolute terms, and dense areas have more cafes than
parks. The names contradicted the user's own request, which torches trust on the
first screen.

### D-13 · Recalibrated scoring k-values; accepted that `local` saturates on similar routes
**Decision.** Raised saturation constants (coffee k 3→5, local diversity 4→7 /
density 8→12, lit night 4→6) and rebalanced `local` toward raw interesting-POI
count over type-diversity.
**Why.** Live diagnostic on a real Toronto search: `green` differentiated well
(1.3/3.1/2.1) but `local` was pinned at 4.8 across all routes. Diversity is a
poor *differentiator* — every dense neighbourhood hits ~12 POI types, so all
routes looked equally "local." Raising k and weighting raw density spreads the
realistic city band.
**Honest limitation.** When routes share most of their geography (two close
points), `local` *should* score similarly — that's not a bug. The real lever for
differentiation is generating genuinely different routes (waypoint injection),
not manufacturing score spread that isn't there. We tune the curve; we don't fake
the signal.


### D-12 · Split one Google key into a browser key and a server key
**Decision.** Proxy Places + Routes through serverless functions with a
server-only key; load the Maps JS SDK from a separate, referrer-locked browser
key.
**Why.** The original build shipped a single Google key in `index.html`, in the
JS bundle, and in a public repo. HTTP-referrer limits made it not catastrophic
(spoofable, but a speed bump), yet the REST calls ran client-side with the key
in a request header — the pattern a reviewer flags on sight.
**Tradeoff.** The Maps JS SDK genuinely needs a browser-visible key (it runs
client-side), so the key count went *up*, not to zero. That's the honest shape
of the problem: you can eliminate the REST key from the client, not the SDK
key. You lock the SDK key instead of pretending it can be hidden.

### D-11 · Implement Well-Lit as a proxy instead of leaving it a dead toggle
**Decision.** Score `lit` from main-road ratio + night-business density. Label
it in-product as a proxy, not measured lighting.
**Why.** The vibe was offered in the UI but returned `null`, so choosing
"Well-Lit" silently did nothing — a broken promise on a user-facing surface.
The v1 plan was to defer it until city streetlight data existed.
**Tradeoff.** A proxy is weaker than real lux data and can mislead (a quiet,
well-lit residential street scores low; a busy unlit strip could score high).
But a labelled proxy that works beats an honest "coming soon" that silently
no-ops. The limitation is surfaced to the user, not buried.
**Supersedes D-04.**

### D-10 · Build an eval harness for the LLM features only — not the scorer
**Decision.** Golden-set evals for `parse-vibes` (intent) and `narrative`
(groundedness). A plain unit test for the scorer.
**Why.** You evaluate models, where output quality is subjective and can
silently drift. The scorer is a deterministic formula; its output is a direct
function of its inputs. Running an "LLM-as-judge" over a formula would be
theater — the kind of AI-washing this rebuild is explicitly against.
**Finding.** The first groundedness detector flagged *street names* as
hallucinated POIs and reported a false 0%. The narratives were fine; the grader
was wrong. Lesson: validate the grader before trusting its verdict. An
automated eval has its own failure modes.

### D-09 · Reframe "4 AI components" to the honest breakdown
**Decision.** Stop headlining "4 AI components." Describe it as 2 LLM features
(both evaluated) + 1 clustering algorithm + 1 deterministic formula.
**Why.** "4 AI components" lumps two LLM calls, one clustering algorithm, and
one arithmetic formula under a word that cleanly applies to only two of them. A
senior reviewer discounts the inflated count. The credible claim is narrower
and stronger: *I know exactly which parts are AI and which aren't, and why the
scorer shouldn't be.*

---

## 2026-03–04 — Original build (preserved from the v1 case study & PRD)

### D-08 · Waypoint injection as a fallback for low route diversity
**Decision.** When Google's alternatives overlap too much, cluster corridor
POIs and route through the densest "vibe zone."
**Why.** An API test across 6 city pairs returned alternatives for all 6 — but
2/6 overlapped ~100%. Diversity wasn't guaranteed, so the product needed its
own source of genuinely different routes.
**Note.** This is single-linkage spatial clustering (DBSCAN-*family*), not a
learned model. Honest to call an algorithm; not honest to call it "AI" in the
LLM sense (corrected in D-09).

### D-07 · Density-based logarithmic scoring (replacing linear)
**Decision.** Score each vibe as `5·(1−e^(−density/k))`.
**Why.** Linear scoring maxed every downtown route at 5.0 — no
differentiation. The log curve separates realistic densities (2 vs 7 cafes/km)
while still rewarding sparse areas. (It does round to 5.0 at ~15 cafes/km — a
cap, documented, not a differentiation failure in the realistic band.)

### D-06 · Global by design, not Toronto-only
**Decision.** Core product uses only Google Places data (available
everywhere); city-specific datasets (like streetlights) are enhancement layers.
**Why.** A product that only works in one city is a demo. Places-only scoring
works in Paris, Tokyo, São Paulo on day one.

### D-05 · Progressive loading, not blocking
**Decision.** Show routes on the map in 1–2s; load scores (3–5s) and narratives
after. Per-route scoring failures don't drop the route.
**Why.** A walking app that shows a blank screen for 5 seconds feels broken,
even if the eventual result is good.

### D-04 · Cut Well-Lit from the MVP *(superseded by D-11)*
Originally deferred because it was thought to need city streetlight data. The
rebuild found a defensible proxy, so it shipped — see D-11.

### D-03 · Anti-hallucination prompt + template fallback for narratives
**Decision.** Constrain the LLM to only mention verified POIs; fall back to a
template if it fails. The app works with AI off.
**Why.** A route description that invents a café erodes the exact trust the
product is selling. Narratives are a nice-to-have, not load-bearing, so they
must degrade gracefully. (D-10's eval exists to keep this honest.)

### D-02 · Reject AI ideas that don't earn their place
**Rejected.** Personalization (no user base for training data), LLM scenic
scoring (would encode the affluence bias the product is designed to avoid),
AI soundtrack suggestions (feature creep).
**Why.** Knowing what *not* to build with AI is the same muscle as knowing what
to.

### D-01 · Objective signals, not subjective "beauty," to design around bias
**Decision.** Score on park proximity, POI density, road type, local diversity —
never a model's opinion of "nice." Users pick which signals matter.
**Why.** A former Google Maps researcher argued scenic routing would bias toward
affluent areas. That's a design constraint, not a reason not to build. Open
item: run the bias audit (correlate scores with neighbourhood income) — designed,
not yet executed.
