/**
 * Unit test for the DETERMINISTIC vibe scorer.
 *
 * This is deliberately a unit test, not an "AI eval" — vibeScorer.js is a
 * formula, so its output is a direct function of its inputs. We assert that
 * known POI densities land in the expected score bands, and that the
 * logarithmic curve actually differentiates dense routes (the bug that
 * prompted the linear→log rewrite: every route scored 5.0 downtown).
 *
 * Run: node evals/scorer-sanity.test.js   (exit 0 = pass)
 */

import { scoreRoute } from "../src/services/vibeScorer.js";

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name} ${detail ? "— " + detail : ""}`); failures++; }
}

function poi(name, types) { return { id: name, name, types }; }
function route(km, steps = []) { return { distanceMeters: km * 1000, steps }; }

console.log("\n═══ scorer sanity ═══");

// 1) No POIs → low scores, never NaN.
{
  const s = scoreRoute(route(1), []);
  check("empty route scores are finite", [s.green, s.coffee, s.local, s.lit].every((x) => Number.isFinite(x)));
  check("empty route green is low", s.green <= 1.0, `got ${s.green}`);
}

// 2) Log curve DIFFERENTIATES dense vs very-dense (the whole point of the rewrite).
{
  // Realistic downtown band (scorer comment: 5-8 cafes/km busy, 1-2 residential)
  const cafes2 = Array.from({ length: 2 }, (_, i) => poi(`cafe${i}`, ["cafe"]));
  const cafes7 = Array.from({ length: 7 }, (_, i) => poi(`cafe${i}`, ["cafe"]));
  const s2 = scoreRoute(route(1), cafes2).coffee;
  const s7 = scoreRoute(route(1), cafes7).coffee;
  check("coffee rises with density", s7 > s2, `2→${s2}, 7→${s7}`);
  check("realistic densities stay below 5 (differentiable)", s7 < 5.0, `7 cafes/km → ${s7}`);
  check("dense ≠ identical (differentiation works)", Math.abs(s7 - s2) > 0.3, `Δ=${(s7 - s2).toFixed(2)}`);
  // Documented cap: only at UNrealistic density (~15/km) does it round to 5.0.
  const s15 = scoreRoute(route(1), Array.from({ length: 15 }, (_, i) => poi(`c${i}`, ["cafe"]))).coffee;
  check("extreme density caps at 5.0 by design", s15 === 5.0, `15/km → ${s15}`);
}

// 3) Green rewards parks + quiet streets; penalises arterials.
{
  const parks = [poi("p1", ["park"]), poi("p2", ["park"])];
  const quiet = route(1, [{ navigationInstruction: { instructions: "Walk along Elm Pl" } }]);
  const arterial = route(1, [{ navigationInstruction: { instructions: "Turn onto King Boulevard" } }]);
  const gQuiet = scoreRoute(quiet, parks).green;
  const gArterial = scoreRoute(arterial, parks).green;
  check("quiet street scores greener than arterial", gQuiet > gArterial, `quiet=${gQuiet}, arterial=${gArterial}`);
}

// 4) Lit is the INVERSE: arterial + night businesses score higher than a quiet park path.
{
  const nightPois = [poi("bar", ["bar"]), poi("resto", ["restaurant"]), poi("shop", ["convenience_store"])];
  const arterial = route(1, [{ navigationInstruction: { instructions: "Continue on Main Avenue" } }]);
  const quietPark = route(1, [{ navigationInstruction: { instructions: "Walk through the Lane" } }]);
  const litArterial = scoreRoute(arterial, nightPois).lit;
  const litQuiet = scoreRoute(quietPark, [poi("park", ["park"])]).lit;
  check("lit higher on busy arterial than quiet lane", litArterial > litQuiet, `arterial=${litArterial}, quiet=${litQuiet}`);
  check("lit is finite (no longer null)", Number.isFinite(litArterial), `got ${litArterial}`);
}

// 5) All scores clamp to [0,5].
{
  const many = Array.from({ length: 50 }, (_, i) => poi(`x${i}`, ["cafe", "restaurant", "park", "bar"]));
  const s = scoreRoute(route(0.5), many);
  check("scores clamp ≤ 5", [s.green, s.coffee, s.local, s.lit].every((x) => x <= 5));
  check("scores clamp ≥ 0", [s.green, s.coffee, s.local, s.lit].every((x) => x >= 0));
}

console.log(failures === 0 ? "\nscorer sanity: PASS ✅\n" : `\nscorer sanity: ${failures} FAILED ❌\n`);
process.exit(failures === 0 ? 0 : 1);
