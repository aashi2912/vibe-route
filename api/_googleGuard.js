/**
 * Shared guard for the Google REST proxies (places, routes).
 *
 * Why this file exists:
 * Before this, the browser called places.googleapis.com and
 * routes.googleapis.com directly with VITE_GOOGLE_MAPS_KEY baked into
 * the bundle. That key was readable by anyone who opened devtools or
 * the public repo. These proxies move those calls server-side so the
 * REST key (GOOGLE_MAPS_SERVER_KEY) never reaches the browser.
 *
 * The browser still needs a SEPARATE key for the Maps JavaScript SDK
 * (map tiles + Places Autocomplete) — that one can't be proxied and is
 * locked by HTTP referrer instead. See index.html.
 */

// Allow calls only from our own origin(s). Blocks randoms POSTing to the
// proxy from elsewhere to spend our Google quota.
const ALLOWED_ORIGINS = [
  "https://vibe-route.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

export function originAllowed(req) {
  // Allow same-origin requests (no Origin header on same-origin fetch in
  // some browsers) and explicitly allow-listed origins.
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin / server-to-server
  return ALLOWED_ORIGINS.some((o) => origin === o);
}

export function getServerKey() {
  // New name. Fall back to the old VITE_ name so a missed env rename
  // degrades to "still works" rather than "site dead" — but log it loudly.
  const key =
    process.env.GOOGLE_MAPS_SERVER_KEY || process.env.VITE_GOOGLE_MAPS_KEY;
  if (process.env.GOOGLE_MAPS_SERVER_KEY == null && key) {
    console.warn(
      "[googleGuard] Using VITE_GOOGLE_MAPS_KEY as a fallback. " +
        "Set GOOGLE_MAPS_SERVER_KEY (server-only, unrestricted-by-referrer) and remove the VITE_ one."
    );
  }
  return key || null;
}
