import { useState, useRef, useEffect } from "react";
import { ROUTE_COLORS } from "../utils/constants";
import { decodePolyline } from "../utils/geo";

/**
 * NavigationScreen — in-app turn-by-turn walking.
 *
 * Uses the route's own steps (navigationInstruction, maneuver, distance,
 * per-step polyline) — no extra API calls. This is a PREVIEW of the walk you
 * step through, not live GPS tracking (honest scope: we don't read device
 * location). The map re-centers on the active step; "Open in Google Maps"
 * hands off to live GPS navigation when you're ready to actually walk it.
 */
export default function NavigationScreen({ route, routeIndex, isNight, origin, destination, onBack }) {
  const [i, setI] = useState(0);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const activeLine = useRef(null);
  const marker = useRef(null);

  const steps = (route?.steps || []).filter((s) => s.navigationInstruction?.instructions);
  const color = ROUTE_COLORS[routeIndex] || "#2f6b4e";
  const step = steps[i];

  // Full route polyline for context
  const fullPath = (route?.decodedPolyline && route.decodedPolyline.length
    ? route.decodedPolyline
    : route?.polylineEncoded ? decodePolyline(route.polylineEncoded) : []
  ).map((p) => ({ lat: p.latitude, lng: p.longitude }));

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps || fullPath.length === 0) return;
    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        zoom: 17, disableDefaultUI: true, gestureHandling: "greedy",
        styles: isNight ? nightMapStyles : [],
      });
      new window.google.maps.Polyline({
        path: fullPath, strokeColor: color, strokeOpacity: 0.35, strokeWeight: 5,
        map: mapInstance.current,
      });
    }
    mapInstance.current.setOptions({ styles: isNight ? nightMapStyles : [] });
  }, [fullPath.length, isNight]);

  // Re-center + highlight the active step
  useEffect(() => {
    if (!mapInstance.current || !step) return;
    const segPts = step.polyline?.encodedPolyline ? decodePolyline(step.polyline.encodedPolyline) : [];
    const start = step.startLocation?.latLng;
    if (activeLine.current) activeLine.current.setMap(null);
    if (segPts.length) {
      activeLine.current = new window.google.maps.Polyline({
        path: segPts.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        strokeColor: color, strokeOpacity: 1, strokeWeight: 7, zIndex: 20,
        map: mapInstance.current,
      });
    }
    if (start) {
      const pos = { lat: start.latitude, lng: start.longitude };
      mapInstance.current.panTo(pos);
      if (marker.current) marker.current.setMap(null);
      marker.current = new window.google.maps.Marker({
        position: pos, map: mapInstance.current,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
      });
    }
  }, [i, step, color]);

  if (!route) return null;
  const total = steps.length;
  const done = i >= total - 1;
  const mapsUrl = buildMapsUrl(origin, destination, route);

  const fg = isNight ? "text-night-text" : "text-earth-800";
  const sub = isNight ? "text-night-muted" : "text-earth-400";

  return (
    <div className={`min-h-screen flex flex-col ${isNight ? "bg-night-bg" : "bg-earth-50"}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${isNight ? "border-night-border bg-night-bg" : "border-earth-200 bg-earth-50"}`}
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <button onClick={onBack} aria-label="Back" className={`text-xl p-1 btn-press ${fg}`}>←</button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold font-body truncate ${fg}`}>{route.name || "Your walk"}</p>
          <p className={`text-xs font-body ${sub}`}>Step {i + 1} of {total} · preview</p>
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} className="w-full" style={{ height: "42vh", minHeight: 240 }}>
        {!window.google?.maps && (
          <div className={`flex items-center justify-center h-full text-sm font-body ${sub}`}>Loading map…</div>
        )}
      </div>

      {/* Current instruction */}
      <div className="flex-1 flex flex-col">
        <div className={`px-5 py-5 flex items-start gap-4 ${isNight ? "bg-night-card" : "bg-white"} border-b ${isNight ? "border-night-border" : "border-earth-100"}`}>
          <div className="text-3xl flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}1a` }}>{maneuverIcon(step?.navigationInstruction?.maneuver)}</div>
          <div className="min-w-0">
            <p className={`text-[17px] font-semibold font-body leading-snug ${fg}`}>
              {step?.navigationInstruction?.instructions || "Arrive at your destination"}
            </p>
            {step?.distanceMeters != null && (
              <p className={`text-sm font-body mt-1 tabular-nums ${sub}`}>{fmtDist(step.distanceMeters)}</p>
            )}
          </div>
        </div>

        {/* Step list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 content-container">
          {steps.map((s, idx) => (
            <button key={idx} onClick={() => setI(idx)}
              className={`w-full text-left flex items-start gap-3 py-2.5 px-3 rounded-xl mb-1 transition-colors ${
                idx === i ? (isNight ? "bg-night-card" : "bg-white shadow-card")
                          : "opacity-60 hover:opacity-100"}`}>
              <span className="text-lg flex-shrink-0 w-6 text-center">{maneuverIcon(s.navigationInstruction?.maneuver)}</span>
              <span className="min-w-0">
                <span className={`block text-[13px] font-body leading-snug ${fg}`}>{s.navigationInstruction?.instructions}</span>
                {s.distanceMeters != null && <span className={`block text-[11px] font-body tabular-nums ${sub}`}>{fmtDist(s.distanceMeters)}</span>}
              </span>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className={`px-4 py-3 flex gap-3 border-t ${isNight ? "border-night-border bg-night-bg" : "border-earth-200 bg-earth-50"}`}
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}>
          <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}
            className={`px-5 py-3 rounded-xl text-sm font-semibold font-body btn-press disabled:opacity-40 ${
              isNight ? "bg-night-card text-night-text" : "bg-white text-earth-700 border border-earth-200"}`}>Back</button>
          {done ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 py-3 rounded-xl text-white text-center text-sm font-bold font-body btn-press"
              style={{ backgroundColor: color }}>Walk it live in Google Maps →</a>
          ) : (
            <button onClick={() => setI((n) => Math.min(total - 1, n + 1))}
              className="flex-1 py-3 rounded-xl text-white text-sm font-bold font-body btn-press"
              style={{ backgroundColor: color }}>Next step</button>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtDist(m) {
  if (m == null) return "";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function maneuverIcon(m) {
  const map = {
    DEPART: "🏁", TURN_LEFT: "↰", TURN_RIGHT: "↱", TURN_SLIGHT_LEFT: "↖", TURN_SLIGHT_RIGHT: "↗",
    TURN_SHARP_LEFT: "⬅", TURN_SHARP_RIGHT: "➡", STRAIGHT: "↑", UTURN_LEFT: "↩", UTURN_RIGHT: "↪",
    RAMP_LEFT: "↰", RAMP_RIGHT: "↱", MERGE: "⤭", FORK_LEFT: "↖", FORK_RIGHT: "↗",
    ROUNDABOUT_LEFT: "↺", ROUNDABOUT_RIGHT: "↻", NAME_CHANGE: "↑",
  };
  return map[m] || "↑";
}

function buildMapsUrl(origin, destination, route) {
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=walking`;
  if (route.waypointUsed) url += `&waypoints=${route.waypointUsed.latitude},${route.waypointUsed.longitude}`;
  return url;
}

const nightMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#141b22" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#141b22" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7c867f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2b343c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1a22" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#17271c" }] },
];
