/**
 * Vercel Serverless Function — live metrics reader.
 *
 * Reads the Vibe Route funnel from PostHog server-side (HogQL), so the public
 * /metrics page never needs a read key in the browser. Cached 60s so it can't
 * hammer PostHog even under traffic. Degrades to an honest "awaiting data"
 * state before any events arrive — never fabricates numbers.
 *
 * Env (set in Vercel):
 *   POSTHOG_PROJECT_ID        the numeric project id
 *   POSTHOG_PERSONAL_API_KEY  a personal key with read scope (phx_…)
 *   POSTHOG_API_HOST          optional, defaults to US cloud
 */

let cache = { at: 0, data: null };
const TTL_MS = 60_000;

const HOST = () => process.env.POSTHOG_API_HOST || "https://us.posthog.com";

async function hogql(query) {
  const pid = process.env.POSTHOG_PROJECT_ID;
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const res = await fetch(`${HOST()}/api/projects/${pid}/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) throw new Error(`posthog ${res.status}`);
  const j = await res.json();
  return j.results || [];
}

function num(rows, i = 0, j = 0) {
  return rows?.[i]?.[j] != null ? Number(rows[i][j]) : 0;
}

export default async function handler(req, res) {
  // Eval-quality numbers are real and static (from the committed eval run).
  const evalStrip = {
    parse_vibes_f1: 1.0,
    parse_vibes_exact: 1.0,
    narrative_groundedness: 1.0,
    cases: 20,
  };

  if (!process.env.POSTHOG_PROJECT_ID || !process.env.POSTHOG_PERSONAL_API_KEY) {
    return res.status(200).json({ configured: false, evalStrip });
  }

  if (cache.data && Date.now() - cache.at < TTL_MS) {
    return res.status(200).json(cache.data);
  }

  try {
    // One combined pass over the last 30 days.
    const base = "events WHERE timestamp > now() - INTERVAL 30 DAY";
    const [
      visitors, searches, generated, selected, shared, nlOk, nlAll, vibezone,
    ] = await Promise.all([
      hogql(`SELECT count(DISTINCT person_id) FROM ${base} AND event = 'session_start'`),
      hogql(`SELECT count() FROM ${base} AND event = 'route_search'`),
      hogql(`SELECT count() FROM ${base} AND event = 'routes_generated'`),
      hogql(`SELECT count() FROM ${base} AND event = 'route_selected'`),
      hogql(`SELECT count() FROM ${base} AND event = 'share_clicked'`),
      hogql(`SELECT count() FROM ${base} AND event = 'nl_query_parsed' AND properties.success = true`),
      hogql(`SELECT count() FROM ${base} AND event = 'nl_query_parsed'`),
      hogql(`SELECT avg(toFloat(properties.num_vibezone_routes)) FROM ${base} AND event = 'routes_generated'`),
    ]);

    // Channel attribution (top referrers/utm sources among session_start).
    const channels = await hogql(
      `SELECT coalesce(nullIf(properties.utm_source, ''), properties.referrer, 'direct') AS src,
              count(DISTINCT person_id) AS n
       FROM ${base} AND event = 'session_start'
       GROUP BY src ORDER BY n DESC LIMIT 6`
    );

    // Day-3 retention: visitors who had a session_start, then another ≥3 days later.
    const retention = await hogql(
      `SELECT count() FROM (
         SELECT person_id, min(timestamp) AS first, max(timestamp) AS last
         FROM ${base} AND event = 'session_start'
         GROUP BY person_id
         HAVING dateDiff('day', first, last) >= 3
       )`
    );

    const v = num(visitors), g = num(generated), sel = num(selected), sh = num(shared);
    const data = {
      configured: true,
      window_days: 30,
      updated_at: new Date().toISOString(),
      visitors: v,
      searches: num(searches),
      routes_generated: g,
      routes_selected: sel,
      shares: sh,
      retained_d3: num(retention),
      avg_vibezone_routes: Math.round(num(vibezone) * 10) / 10,
      // The 4 hiring numbers:
      activation_rate: v ? Math.round((g / v) * 1000) / 10 : null, // visitor → routes generated
      aha_rate: v ? Math.round((sel / v) * 1000) / 10 : null,       // visitor → route selected
      share_rate: g ? Math.round((sh / g) * 1000) / 10 : null,      // of activated
      retention_rate: v ? Math.round((num(retention) / v) * 1000) / 10 : null,
      nl_success_rate: num(nlAll) ? Math.round((num(nlOk) / num(nlAll)) * 1000) / 10 : null,
      channels: channels.map((r) => ({ src: String(r[0]).slice(0, 40), visitors: Number(r[1]) })),
      evalStrip,
    };
    cache = { at: Date.now(), data };
    return res.status(200).json(data);
  } catch (e) {
    console.error("metrics error:", e);
    // On a read failure, still return the real eval strip + an honest flag.
    return res.status(200).json({ configured: true, error: true, evalStrip });
  }
}
