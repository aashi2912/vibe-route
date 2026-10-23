# Analytics Setup — Vibe Route

Vibe Route shares **one PostHog project with Blind Spot** (free plan = 1 project).
To keep the funnels from mixing, every Vibe Route event is tagged with a
`product: "vibe_route"` super-property (set in `src/utils/analytics.js`), and the
`/metrics` reader (`api/metrics.js`) filters every query on it. So counts stay
accurate even though the raw events live alongside Blind Spot's.

## Env vars to set in Vercel (Vibe Route project)

| Var | Value | Where to get it |
|---|---|---|
| `VITE_POSTHOG_KEY` | the `phc_…` project key | PostHog → Project settings → Project API Key (same project as Blind Spot) |
| `POSTHOG_PROJECT_ID` | the project number (e.g. `676728`) | PostHog URL: `us.posthog.com/project/<NUMBER>/…`, or Project settings |
| `POSTHOG_PERSONAL_API_KEY` | a `phx_…` read key | PostHog → Settings → Personal API keys → create (or reuse Blind Spot's if it has org/all-projects read scope) |
| `VITE_POSTHOG_HOST` | optional, defaults to `https://us.i.posthog.com` | only set if your PostHog is EU-hosted |

No new project needed. Do NOT create a second PostHog org.

## How separation works
- Client: `posthog.register({ product: "vibe_route" })` tags every event.
- Server (`/metrics`): all HogQL queries use
  `WHERE properties.product = 'vibe_route' AND …`.
- Blind Spot's events (no such tag, or a different tag) are never counted here,
  and Vibe Route's never pollute Blind Spot's dashboard.

## Verify after deploy
1. Open the live site, do a search.
2. In PostHog → Activity, you should see `session_start`, `route_search`,
   `routes_generated` with `product = vibe_route`.
3. Open `vibe-route.vercel.app/metrics` — the funnel should show your test session.
