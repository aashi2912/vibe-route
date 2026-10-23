/**
 * Lightweight analytics — dependency-free.
 *
 * Loads Vercel Web Analytics + Speed Insights via their script endpoints
 * (same data the @vercel/* packages collect) and exposes track() for a small
 * product event funnel. Everything is best-effort and no-ops if the scripts
 * are blocked or offline, so analytics can never break the app.
 *
 * Privacy: Vercel Web Analytics is cookieless and doesn't collect PII. We only
 * send event names + coarse props (which vibes, route count) — never addresses
 * or coordinates.
 */

let booted = false;

export function initAnalytics() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  // Vercel Web Analytics (cookieless pageviews + custom events via window.va)
  try {
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    inject("https://va.vercel-scripts.com/v1/script.debug.js".replace(".debug", ""));
    // Speed Insights (real-user load performance)
    inject("https://va.vercel-scripts.com/v1/speed-insights/script.js");
  } catch { /* blocked — fine */ }
}

function inject(src) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.src = src; s.defer = true;
  document.head.appendChild(s);
}

/**
 * Track a product event. Safe to call anywhere; silently no-ops if analytics
 * isn't loaded. Keep props small and non-identifying.
 */
export function track(event, props = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.va === "function") {
      window.va("event", { name: event, ...props });
    }
  } catch { /* never throw from analytics */ }
}
