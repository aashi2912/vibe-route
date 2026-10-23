import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

/**
 * Load the Google Maps JavaScript SDK dynamically from a browser-visible key.
 *
 * This key is loaded from VITE_GOOGLE_MAPS_BROWSER_KEY (not hardcoded in HTML).
 * It is a SEPARATE key from the server-only GOOGLE_MAPS_SERVER_KEY used by the
 * /api/routes and /api/places proxies. Lock this browser key in Google Cloud to
 * HTTP referrers (your domain + localhost) and to the Maps JavaScript API +
 * Places API only — those referrer limits are the only thing protecting a
 * browser key, so they are not optional.
 */
function loadMapsSdk() {
  const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
  if (!key) {
    // Autocomplete + map degrade gracefully (manual lat/lng still works),
    // so a missing browser key is a warning, not a crash.
    console.warn(
      "VITE_GOOGLE_MAPS_BROWSER_KEY is not set — map tiles and address " +
        "autocomplete will be disabled. Add it to .env (and Vercel)."
    );
    return;
  }
  if (document.querySelector('script[data-google-maps]')) return;
  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
    key
  )}&libraries=places&callback=Function.prototype`;
  s.async = true;
  s.setAttribute("data-google-maps", "true");
  document.head.appendChild(s);
}

loadMapsSdk();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
