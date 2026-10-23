/**
 * Product analytics — PostHog (mirrors Blind Spot for a consistent portfolio).
 *
 * Loads posthog-js via the official snippet (dependency-free — avoids the npm
 * peer-dep conflict in this project) and exposes track(). The client key
 * (VITE_POSTHOG_KEY, a phc_… public ingestion key) is safe to ship; it can
 * only write events, not read data. The /metrics dashboard reads server-side
 * with a separate personal key.
 *
 * Everything is best-effort: if the key is missing or the script is blocked,
 * track() silently no-ops. Analytics never breaks the app.
 *
 * Privacy: we send event names + coarse props (vibe ids, route counts, ranks,
 * latency). Never addresses or coordinates.
 */

let ready = false;

export function initAnalytics() {
  if (ready || typeof window === "undefined") return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";
  if (!key) {
    // No key yet — track() will no-op. App works fine without analytics.
    return;
  }
  try {
    // Official PostHog array-stub snippet (queues calls until the lib loads).
    !(function (t, e) {
      var o, n, p, r;
      e.__SV ||
        ((window.posthog = e),
        (e._i = []),
        (e.init = function (i, s, a) {
          function g(t, e) {
            var o = e.split(".");
            2 == o.length && ((t = t[o[0]]), (e = o[1]));
            t[e] = function () {
              t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
            };
          }
          (p = t.createElement("script")).type = "text/javascript";
          p.crossOrigin = "anonymous";
          p.async = !0;
          p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
          (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
          var u = e;
          for (
            void 0 !== a ? (u = e[a] = []) : (a = "posthog"),
              u.people = u.people || [],
              u.toString = function (t) {
                var e = "posthog";
                return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e;
              },
              u.people.toString = function () {
                return u.toString(1) + ".people (stub)";
              },
              o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId".split(" "),
              n = 0;
            n < o.length;
            n++
          )
            g(u, o[n]);
          e._i.push([i, s, a]);
        }),
        (e.__SV = 1));
    })(document, window.posthog || []);

    window.posthog.init(key, {
      api_host: host,
      person_profiles: "identified_only",
      capture_pageview: false, // fired manually below, AFTER the product tag
      autocapture: false, // we send explicit, named funnel events only
    });
    // Tag every event with the product so this shares a PostHog project with
    // other apps (e.g. Blind Spot) WITHOUT mixing funnels. All /metrics queries
    // filter on properties.product = 'vibe_route', so counts stay accurate.
    window.posthog.register({ product: "vibe_route" });
    ready = true;
    window.posthog.capture("$pageview");
    // North-star funnel entry.
    track("session_start", utmProps());
  } catch {
    /* blocked — fine */
  }
}

function utmProps() {
  try {
    const q = new URLSearchParams(window.location.search);
    const p = { referrer: document.referrer || "direct" };
    ["utm_source", "utm_medium", "utm_campaign"].forEach((k) => {
      const v = q.get(k);
      if (v) p[k] = v;
    });
    return p;
  } catch {
    return {};
  }
}

export function track(event, props = {}) {
  try {
    if (typeof window !== "undefined" && window.posthog && typeof window.posthog.capture === "function") {
      window.posthog.capture(event, props);
    }
  } catch {
    /* never throw from analytics */
  }
}
