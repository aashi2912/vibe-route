/**
 * Vibe Route eval runner.
 *
 * Evaluates the two real LLM features against golden sets:
 *   - parse-vibes : intent classification (exact match + F1)
 *   - narrative   : groundedness (deterministic + LLM-as-judge)
 *
 * Uses the SAME prompts and model the app ships, so a prompt/model change
 * that regresses quality shows up here. The deterministic vibe scorer is
 * intentionally NOT evaluated here (see README) — it has a unit test instead.
 *
 * Usage:  node evals/run.js [parse-vibes|narrative]
 * Env:    LLM_API_KEY (same key the app uses)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-haiku-4-5-20251001";
const JUDGE_MODEL = "claude-haiku-4-5-20251001";
const API_KEY = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;

// Two modes:
//   endpoint (default) — call the DEPLOYED app at BASE_URL. Tests real prod.
//                        No key needed locally; the key lives in Vercel.
//   direct             — call Anthropic directly (needs LLM_API_KEY). Set MODE=direct.
const BASE_URL = process.env.VIBE_ROUTE_URL || "https://vibe-route.vercel.app";
const MODE = process.env.EVAL_MODE || (API_KEY ? process.env.EVAL_MODE || "endpoint" : "endpoint");

const THRESHOLDS = { "parse-vibes": 0.85, narrative: 0.9 };

// ── Anthropic call ─────────────────────────────────────────
async function callClaude(prompt, maxTokens = 250) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ── Live-endpoint callers (default mode) ───────────────────
async function callParseEndpoint(text) {
  const res = await fetch(`${BASE_URL}/api/parse-vibes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`parse-vibes endpoint ${res.status}`);
  const data = await res.json();
  return data; // { vibes: [...] } — already parsed + validated server-side
}

async function callNarrativeEndpoint(prompt) {
  const res = await fetch(`${BASE_URL}/api/narrative`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`narrative endpoint ${res.status}`);
  const data = await res.json();
  return data.narrative || "";
}

function loadCases(suite) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "cases", `${suite}.json`), "utf8")
  );
}

// ── Prompts (mirror the app's shipped prompts) ─────────────
function parseVibesPrompt(text) {
  return `You are a route preference parser. The user described their ideal walk. Extract which vibes they want from this list:
- "green" = parks, trees, nature, quiet, peaceful, greenery
- "coffee" = cafes, coffee shops, coffee stops
- "local" = local shops, restaurants, character, culture, neighbourhood, explore, food
- "lit" = well-lit, safe, bright, busy streets (for night walks)

User's description: "${text}"

Respond with ONLY a JSON array of matching vibe IDs. If nothing matches clearly, return ["green", "local"] as defaults.

JSON array:`;
}

function narrativePrompt(rd) {
  const minutes = Math.round(rd.durationSeconds / 60);
  const km = (rd.distanceMeters / 1000).toFixed(1);
  const streetList = (rd.streets || []).slice(0, 6).join(" → ");
  const poiList = (rd.pois || []).map((p) => `${p.name} (${p.type})`).join(", ");
  const s = rd.scores || {};
  const top = Object.entries(s).sort((a, b) => b[1] - a[1])[0]?.[0] || "green";
  return `Describe this walking route in exactly 2-3 sentences for someone deciding which way to walk.

RULES:
- ONLY mention places from the POI list below. Do NOT invent any locations.
- Be specific about the feel and character of the walk.
- Keep it warm and helpful, like a friend who knows the neighbourhood.
- Mention the strongest vibe quality naturally (don't say "score" or "rating").
- ${rd.isNight ? "It's evening/night — mention anything relevant to walking after dark." : "It's daytime."}

ROUTE DATA:
- Distance: ${km} km (~${minutes} min walk)
- Streets: ${streetList || "various local streets"}
- POIs along route: ${poiList || "none found nearby"}
- Strongest quality: ${top}
- Green score: ${s.green?.toFixed(1) || "0"}/5
- Coffee score: ${s.coffee?.toFixed(1) || "0"}/5
- Local character score: ${s.local?.toFixed(1) || "0"}/5

Write the 2-3 sentence description:`;
}

// ── Scoring: parse-vibes ───────────────────────────────────
function parseVibesFromText(text) {
  const valid = ["green", "coffee", "local", "lit"];
  const m = text.match(/\[.*\]/s);
  if (!m) return [];
  try {
    return JSON.parse(m[0]).filter((v) => valid.includes(v));
  } catch {
    return [];
  }
}

function setF1(pred, exp) {
  const P = new Set(pred), E = new Set(exp);
  const tp = [...P].filter((x) => E.has(x)).length;
  if (tp === 0) return 0;
  const precision = tp / P.size;
  const recall = tp / E.size;
  return (2 * precision * recall) / (precision + recall);
}

async function runParseVibes() {
  const { cases } = loadCases("parse-vibes");
  const rows = [];
  for (const c of cases) {
    let pred;
    if (MODE === "endpoint") {
      const out = await callParseEndpoint(c.input);
      pred = (out.vibes || []).filter((v) => ["green","coffee","local","lit"].includes(v));
    } else {
      pred = parseVibesFromText(await callClaude(parseVibesPrompt(c.input), 50));
    }
    const exact = JSON.stringify([...pred].sort()) === JSON.stringify([...c.expected].sort());
    const f1 = setF1(pred, c.expected);
    rows.push({ id: c.id, input: c.input, expected: c.expected, pred, exact, f1 });
  }
  const exactRate = rows.filter((r) => r.exact).length / rows.length;
  const avgF1 = rows.reduce((a, r) => a + r.f1, 0) / rows.length;
  return { suite: "parse-vibes", rows, metrics: { exactRate, avgF1 }, score: avgF1 };
}

// ── Scoring: narrative groundedness ────────────────────────
function deterministicGroundedness(narrative, allowedPois, streets = []) {
  // Flag capitalised multi-word phrases that look like place names but
  // aren't in the allowed list. Conservative: only proper-noun-ish spans.
  const allowed = [...allowedPois, ...streets].map((p) => p.toLowerCase());
  // A candidate that IS a street (ends in a street-type token, or matches an
  // input street) is allowed by the prompt and never counts as invented.
  const STREET_RE = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|trail|way|lane|ln|dr|drive|cres|crescent|pkwy|parkway|hwy|highway)\.?$/i;
  const candidates =
    narrative.match(/\b([A-Z][a-zA-Z'&]+(?:\s+(?:[A-Z][a-zA-Z'&]+|&|and|of|the))*)\b/g) || [];
  const stop = new Set([
    "A","An","The","This","It","You","Your","If","For","With","At","On","In",
    "Start","End","Walk","Route","Along","Near","Street","Avenue","Road","Trail",
    "North","South","East","West","Toronto","It's","There","Then","After","Evening","Night",
    "St","Ave","Blvd","Rd","Dr","Ln","Way","Trail","Queen","King","College","Ossington","Roncesvalles","Martin","Goodman",
  ]);
  const invented = [];
  for (const cand of candidates) {
    const c = cand.trim().replace(/^(It's|Its|There's|That's)\s+/i, "");
    const words = c.split(/\s+/);
    if (words.every((w) => stop.has(w))) continue;
    if (stop.has(c)) continue;
    if (/^[a-z]/.test(c)) continue; // must start capitalised
    const cl = c.toLowerCase();
    if (STREET_RE.test(c)) continue; // street name — allowed
    const inList = allowed.some((a) => a.includes(cl) || cl.includes(a));
    // A plausible venue: a venue keyword, OR 2+ capitalised words none of
    // which is a stopword (so "It's the" / "After Dark" don't qualify).
    const contentWords = words.filter((w) => !stop.has(w) && /^[A-Z]/.test(w));
    const looksLikePlace =
      /Park|Cafe|Café|Bar|Books|Garden|Bellwoods|Ramen|Bookshop|Music/i.test(c) ||
      contentWords.length >= 2;
    if (!inList && looksLikePlace) invented.push(c);
  }
  const uniqueInvented = [...new Set(invented)];
  return { grounded: uniqueInvented.length === 0, invented: uniqueInvented };
}

async function judgeGroundedness(narrative, allowedPois) {
  const list = allowedPois.length ? allowedPois.join(", ") : "(none — no POIs were provided)";
  const prompt = `You are grading whether a walking-route description invents places.

ALLOWED PLACES (the only named places that may appear): ${list}

DESCRIPTION:
"${narrative}"

Did the description mention any specific named place (business, park, landmark) NOT in the allowed list? Street names are fine. Generic words like "a cafe" or "the park" are fine. Only flag SPECIFIC invented names.

Respond with ONLY JSON: {"grounded": true|false, "score": 1-5, "invented": ["..."]}`;
  const raw = await callClaude(prompt, 150);
  const m = raw.match(/\{.*\}/s);
  try { return JSON.parse(m[0]); } catch { return { grounded: null, score: null, invented: [], parseError: true }; }
}

async function runNarrative() {
  const { cases } = loadCases("narrative");
  const rows = [];
  for (const c of cases) {
    const prompt = narrativePrompt(c.routeData);
    const narrative = (MODE === "endpoint"
      ? await callNarrativeEndpoint(prompt)
      : await callClaude(prompt, 250)).trim();
    const det = deterministicGroundedness(narrative, c.allowedPois, c.routeData.streets || []);
    // Judge still needs a direct key; skip gracefully in endpoint mode w/o key.
    const judge = API_KEY
      ? await judgeGroundedness(narrative, c.allowedPois)
      : { grounded: null, score: null, invented: [], skipped: true };
    const grounded = det.grounded && judge.grounded !== false;
    rows.push({
      id: c.id, narrative,
      detGrounded: det.grounded, detInvented: det.invented,
      judgeGrounded: judge.grounded, judgeScore: judge.score, judgeInvented: judge.invented || [],
      grounded,
    });
  }
  const groundedRate = rows.filter((r) => r.grounded).length / rows.length;
  return { suite: "narrative", rows, metrics: { groundedRate }, score: groundedRate };
}

// ── Report ─────────────────────────────────────────────────
function report(result) {
  const thr = THRESHOLDS[result.suite];
  const pass = result.score >= thr;
  console.log(`\n═══ ${result.suite} ═══`);
  if (result.suite === "parse-vibes") {
    for (const r of result.rows) {
      const mark = r.exact ? "✓" : r.f1 >= 0.5 ? "~" : "✗";
      console.log(`  ${mark} ${r.id}  f1=${r.f1.toFixed(2)}  "${r.input.slice(0, 40)}"  →  [${r.pred}]  (want [${r.expected}])`);
    }
    console.log(`  exact-match: ${(result.metrics.exactRate * 100).toFixed(0)}%   avg F1: ${result.metrics.avgF1.toFixed(3)}`);
  } else {
    for (const r of result.rows) {
      const mark = r.grounded ? "✓" : "✗";
      const inv = [...new Set([...r.detInvented, ...r.judgeInvented])];
      console.log(`  ${mark} ${r.id}  judge=${r.judgeScore ?? "?"}/5  ${inv.length ? "INVENTED: " + inv.join(", ") : "grounded"}`);
    }
    console.log(`  groundedness: ${(result.metrics.groundedRate * 100).toFixed(0)}%`);
  }
  console.log(`  threshold ${thr} → ${pass ? "PASS ✅" : "FAIL ❌"}`);
  return pass;
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  if (MODE === "direct" && !API_KEY) {
    console.error("ERROR: MODE=direct needs LLM_API_KEY (or ANTHROPIC_API_KEY).");
    process.exit(2);
  }
  console.log(`mode: ${MODE}${MODE === "endpoint" ? ` (${BASE_URL})` : ""}${!API_KEY ? "  [LLM-judge skipped: no key]" : ""}`);
  const which = process.argv[2];
  const suites = which ? [which] : ["parse-vibes", "narrative"];
  let allPass = true;
  for (const s of suites) {
    const result = s === "parse-vibes" ? await runParseVibes() : await runNarrative();
    const pass = report(result);
    allPass = allPass && pass;
  }
  console.log(`\n${allPass ? "All suites passed ✅" : "Some suites failed ❌"}\n`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
