import { useState, useEffect, useRef } from "react";
import { orchestrateRoutes } from "../services/routeOrchestrator";
import { decodePolyline } from "../utils/geo";
import { ROUTE_COLORS, VIBES } from "../utils/constants";

/**
 * ResultsScreen — Week 4 (polished)
 *
 * Changes from Week 3:
 * - Max-width container for readability on desktop
 * - CSS class for narrative clamping (reliable)
 * - Single tap → detail screen (no double-tap)
 * - Responsive map height
 * - Route card hover/press effects
 * - Loading progress steps
 */

export default function ResultsScreen({
  isNight,
  origin,
  destination,
  selectedVibes,
  onBack,
  onViewDetail,
}) {
  const [routes, setRoutes] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef([]);
  const markersRef = useRef([]);

  // Pipeline
  useEffect(() => {
    if (!origin || !destination) return;
    let cancelled = false;

    async function run() {
      try {
        setPhase("loading");
        setError(null);
        setRoutes([]);

        await orchestrateRoutes(
          origin, destination, selectedVibes, isNight,
          (basic) => {
            if (cancelled) return;
            setRoutes(basic);
            setPhase("scoring");
            if (basic.length > 0) setSelectedRouteId(basic[0].id);
          },
          (scored) => {
            if (cancelled) return;
            setRoutes(scored);
            setPhase("narratives");
            if (scored.length > 0) setSelectedRouteId(scored[0].id);
          },
          (final) => {
            if (cancelled) return;
            setRoutes(final);
            setPhase("done");
          }
        );
      } catch (err) {
        if (cancelled) return;
        console.error("Pipeline error:", err);
        setError(err.message);
        setPhase("error");
      }
    }

    run();
    return () => { cancelled = true; };
  }, [origin, destination, selectedVibes, isNight]);

  // Map rendering
  useEffect(() => {
    if (!mapRef.current || routes.length === 0 || !window.google?.maps) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 14,
        center: { lat: origin.latitude, lng: origin.longitude },
        styles: isNight ? nightMapStyles : [],
        disableDefaultUI: true,
        zoomControl: true,
      });
    } else {
      mapInstanceRef.current.setOptions({ styles: isNight ? nightMapStyles : [] });
    }

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();

    routes.forEach((route, index) => {
      const points = route.decodedPolyline ||
        (route.polylineEncoded ? decodePolyline(route.polylineEncoded) : []);
      if (points.length === 0) return;

      const path = points.map((p) => ({ lat: p.latitude, lng: p.longitude }));
      path.forEach((p) => bounds.extend(p));

      const isSelected = route.id === selectedRouteId;
      const color = ROUTE_COLORS[index] || "#888";

      const polyline = new window.google.maps.Polyline({
        path, geodesic: true,
        strokeColor: color,
        strokeOpacity: isSelected ? 0.9 : 0.35,
        strokeWeight: isSelected ? 5 : 3,
        zIndex: isSelected ? 10 : 1,
        map: mapInstanceRef.current,
      });
      polyline.addListener("click", () => setSelectedRouteId(route.id));
      polylinesRef.current.push(polyline);
    });

    markersRef.current.push(
      new window.google.maps.Marker({
        position: { lat: origin.latitude, lng: origin.longitude },
        map: mapInstanceRef.current, title: "Start",
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#2f6b4e", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      }),
      new window.google.maps.Marker({
        position: { lat: destination.latitude, lng: destination.longitude },
        map: mapInstanceRef.current, title: "Destination",
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#d8772e", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      })
    );

    mapInstanceRef.current.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  }, [routes, isNight, origin, destination]);

  // Polyline selection sync
  useEffect(() => {
    polylinesRef.current.forEach((p, i) => {
      if (i >= routes.length) return;
      const s = routes[i].id === selectedRouteId;
      p.setOptions({ strokeOpacity: s ? 0.9 : 0.35, strokeWeight: s ? 5 : 3, zIndex: s ? 10 : 1 });
    });
  }, [selectedRouteId, routes]);

  const statusMap = {
    loading: "Finding walking routes...",
    scoring: `Scoring ${routes.length} routes by vibe...`,
    narratives: "Writing AI descriptions...",
    done: `${routes.length} routes · Ranked by your vibes`,
    error: "Something went wrong",
  };

  // Progress steps for loading indicator
  const steps = ["Routes", "Scoring", "AI Narratives"];
  const activeStep = { loading: 0, scoring: 1, narratives: 2, done: 3, error: -1 }[phase];

  return (
    <div className={`min-h-screen ${isNight ? "bg-night-bg" : "bg-earth-50"}`}>
      {/* Top bar */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${isNight ? "border-night-border" : "border-earth-200"}`}
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <button onClick={onBack} className={`text-xl p-1 ${isNight ? "text-earth-200" : "text-earth-800"}`}>←</button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold font-body truncate ${isNight ? "text-earth-200" : "text-earth-800"}`}>
            {origin?.address || "Origin"} → {destination?.address || "Destination"}
          </p>
          <p className={`text-xs font-body ${isNight ? "text-night-muted" : "text-earth-400"}`}>{statusMap[phase]}</p>
        </div>
        {(phase === "scoring" || phase === "narratives" || phase === "loading") && (
          <div className="w-4 h-4 border-2 border-vibe-green border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
      </div>

      {/* Progress bar */}
      {phase !== "done" && phase !== "error" && (
        <div className={`px-4 py-2 flex gap-2 items-center ${isNight ? "bg-night-card" : "bg-earth-100"}`}>
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-2 flex-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-body flex-shrink-0 ${
                i < activeStep ? "bg-vibe-green text-white" :
                i === activeStep ? "bg-vibe-green/20 text-vibe-green border-2 border-vibe-green" :
                isNight ? "bg-night-border text-night-muted" : "bg-earth-200 text-earth-400"
              }`}>
                {i < activeStep ? "✓" : i + 1}
              </div>
              <span className={`text-[11px] font-body hidden sm:inline ${
                i <= activeStep ? (isNight ? "text-earth-200" : "text-earth-700") : (isNight ? "text-night-muted" : "text-earth-400")
              }`}>{step}</span>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px ${i < activeStep ? "bg-vibe-green" : isNight ? "bg-night-border" : "bg-earth-200"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} className="w-full map-container">
        {!window.google?.maps && (
          <div className={`flex items-center justify-center h-full text-sm font-body ${isNight ? "text-night-muted bg-night-card" : "text-earth-400 bg-earth-100"}`}>
            Loading map...
          </div>
        )}
      </div>

      {/* Active vibes */}
      <div className={`px-4 py-2 flex gap-1.5 overflow-x-auto vibe-scroll border-b ${isNight ? "border-night-border" : "border-earth-200"}`}>
        {VIBES.filter((v) => selectedVibes.includes(v.id)).map((v) => (
          <span key={v.id} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold font-body bg-vibe-green text-white whitespace-nowrap">
            {v.icon} {v.label}
          </span>
        ))}
      </div>

      {/* Sparse-area honesty: if the whole set found few POIs, say so rather than
          presenting confident low scores as a verdict. */}
      {phase === "done" && routes.length > 0 && (() => {
        const totalPois = routes.reduce((n, r) => n + (r.pois?.length || 0), 0);
        const avg = totalPois / routes.length;
        if (avg >= 10) return null;
        return (
          <div className="px-4 pt-3 content-container">
            <div className={`rounded-xl px-3.5 py-2.5 text-[12.5px] font-body ${isNight ? "bg-night-card text-night-muted" : "bg-earth-100 text-earth-500"}`}>
              🤏 Quiet area — not many parks, cafes, or shops along these routes, so vibe scores here are limited.
            </div>
          </div>
        );
      })()}

      {/* Route cards — constrained width */}
      <div className="px-4 py-3 content-container">
        {phase === "loading" && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`animate-pulse rounded-2xl p-4 ${isNight ? "bg-night-card" : "bg-white"}`}>
                <div className={`h-5 rounded w-1/3 mb-3 ${isNight ? "bg-night-border" : "bg-earth-200"}`} />
                <div className={`h-3 rounded w-2/3 mb-2 ${isNight ? "bg-night-border" : "bg-earth-100"}`} />
                <div className={`h-2 rounded w-full ${isNight ? "bg-night-border" : "bg-earth-100"}`} />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl p-4 bg-red-50 border border-red-200 text-red-800 text-sm font-body">
            <p className="font-semibold mb-1">Couldn't find routes</p>
            <p className="mb-2">{error}</p>
            <button onClick={onBack} className="text-red-600 font-semibold underline btn-press">← Try different locations</button>
          </div>
        )}

        {phase !== "loading" && !error && routes.map((route, index) => {
          const color = ROUTE_COLORS[index] || "#888";
          const hasDist = Number.isFinite(route.distanceMeters) && route.distanceMeters > 0;
          const minutes = route.durationSeconds ? Math.round(route.durationSeconds / 60) : null;
          const km = hasDist ? (route.distanceMeters / 1000).toFixed(1) : null;
          const metaText = hasDist ? `${km} km · ${minutes} min` : "Distance unavailable";
          const hasScores = (phase === "done" || phase === "narratives") && route.scores;
          const isSelected = route.id === selectedRouteId;
          const fastest = Math.min(...routes.map((r) => r.durationSeconds));
          const extraMin = Math.round((route.durationSeconds - fastest) / 60);
          const isFastest = route.durationSeconds === fastest;

          return (
            <div
              key={route.id}
              onClick={() => {
                setSelectedRouteId(route.id);
                if (hasScores && onViewDetail) onViewDetail(route, index);
              }}
              className={`route-card relative overflow-hidden rounded-2xl p-4 pl-5 mb-3 cursor-pointer border ${
                isSelected
                  ? isNight ? "bg-night-card" : "bg-white shadow-lift"
                  : isNight ? "bg-night-card border-night-border" : "bg-white border-earth-100 shadow-card"
              }`}
              style={{
                borderColor: isSelected ? `${color}55` : undefined,
              }}
            >
              {/* Vibe-colored trail spine */}
              <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: color }} aria-hidden="true" />
              {/* Header */}
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div>
                    <p className={`font-display text-base ${isNight ? "text-earth-200" : "text-earth-800"}`}>
                      {route.name || `Route ${index + 1}`}
                    </p>
                    <p className={`text-xs font-body ${isNight ? "text-night-muted" : "text-earth-400"}`}>
                      {metaText}
                      {route.source === "waypoint-injected" && <span className="ml-1" style={{ color: "#7c5bd0" }}>· scenic detour</span>}
                    </p>
                  </div>
                </div>
                {isFastest ? (
                  <span className="text-[11px] font-bold font-body px-2.5 py-1 rounded-full bg-green-50 text-green-700 flex-shrink-0">Fastest</span>
                ) : extraMin > 0 ? (
                  <span className="text-[11px] font-bold font-body px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 flex-shrink-0">+{extraMin} min</span>
                ) : null}
              </div>

              {/* Four-signal readout — shows the MIX, so similar routes are distinguishable.
                  Selected vibes are full-strength; unselected are dimmed context. */}
              {hasScores ? (
                <div className="mt-3.5 flex gap-2">
                  {VIBES.map((vibe) => {
                    const score = route.scores?.[vibe.id];
                    const has = score !== null && score !== undefined;
                    const isSel = selectedVibes.includes(vibe.id);
                    const isBest = (route.bestFor || []).includes(vibe.id);
                    const pct = has ? Math.min(100, (score / 5) * 100) : 0;
                    return (
                      <div key={vibe.id} className={`flex-1 text-center ${isSel ? "" : "opacity-45"}`}>
                        <div className="text-[13px] leading-none mb-1.5 relative" title={vibe.label}>
                          {vibe.icon}
                          {isBest && <span className="absolute -top-1 -right-0.5 text-[8px]" title={`Best for ${vibe.label}`}>⭐</span>}
                        </div>
                        <div className={`h-6 rounded-md overflow-hidden flex items-end ${isNight ? "bg-night-border" : "bg-earth-100"}`}>
                          <div className="score-bar-fill w-full rounded-md" style={{ height: `${pct}%`, backgroundColor: vibe.color }} />
                        </div>
                        <div className={`text-[10px] font-bold font-body mt-1 tabular-nums ${isSel ? (isNight ? "text-night-text" : "text-earth-600") : (isNight ? "text-night-muted" : "text-earth-400")}`}>
                          {has ? score.toFixed(1) : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : phase === "scoring" ? (
                <div className="mt-3.5 flex gap-2">
                  {VIBES.map((vibe) => (
                    <div key={vibe.id} className="flex-1 text-center">
                      <div className="text-[13px] leading-none mb-1.5">{vibe.icon}</div>
                      <div className={`h-6 rounded-md animate-pulse ${isNight ? "bg-night-border" : "bg-earth-100"}`} />
                    </div>
                  ))}
                </div>
              ) : null}

              {/* AI Narrative preview — clamped to 2 lines */}
              {route.narrative && (
                <p className={`mt-3 text-[13px] font-body leading-relaxed narrative-clamp ${isNight ? "text-night-muted" : "text-earth-500"}`}>
                  {route.narrative}
                </p>
              )}
              {phase === "narratives" && !route.narrative && (
                <div className="mt-3 space-y-1.5 animate-pulse">
                  <div className={`h-3 rounded w-full ${isNight ? "bg-night-border" : "bg-earth-100"}`} />
                  <div className={`h-3 rounded w-3/4 ${isNight ? "bg-night-border" : "bg-earth-100"}`} />
                </div>
              )}

              {/* POI pills */}
              {hasScores && route.displayPois && route.displayPois.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {route.displayPois.map((poi, i) => (
                    <span key={poi.id || i} className={`text-[11px] font-body px-2 py-0.5 rounded-md ${isNight ? "bg-night-bg text-night-muted" : "bg-earth-50 text-earth-500"}`}>
                      {getPoiIcon(poi.types)} {poi.name}
                    </span>
                  ))}
                  {route.pois && route.pois.length > (route.displayPois?.length || 0) && (
                    <span className={`text-[11px] font-body px-2 py-0.5 rounded-md ${isNight ? "bg-night-bg text-night-muted" : "bg-earth-50 text-earth-400"}`}>
                      +{route.pois.length - route.displayPois.length} nearby
                    </span>
                  )}
                </div>
              ) : !hasScores ? (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {route.steps?.slice(0, 4).map((s) => s.navigationInstruction?.instructions).filter(Boolean).map((instr, i) => (
                    <span key={i} className={`text-[11px] font-body px-2 py-0.5 rounded-md ${isNight ? "bg-night-bg text-night-muted" : "bg-earth-50 text-earth-500"}`}>
                      {instr.length > 25 ? instr.slice(0, 25) + "…" : instr}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Tap hint */}
              {hasScores && (
                <p className={`mt-2 text-[10px] font-body text-center ${isNight ? "text-night-muted/40" : "text-earth-300"}`}>
                  Tap for details →
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Google Maps link — constrained */}
      {selectedRouteId && phase !== "loading" && (
        <div className="px-4 pb-6 content-container">
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=walking`}
            target="_blank" rel="noopener noreferrer"
            className="block w-full py-3.5 rounded-xl bg-vibe-green text-white text-center text-sm font-semibold font-body shadow-lg shadow-vibe-green/20 btn-press"
          >
            Open in Google Maps →
          </a>
        </div>
      )}
    </div>
  );
}

function getPoiIcon(types) {
  if (!types) return "📍";
  if (types.includes("park")) return "🌳";
  if (types.includes("cafe") || types.includes("coffee_shop")) return "☕";
  if (types.includes("restaurant")) return "🍜";
  if (types.includes("bakery")) return "🥐";
  if (types.includes("book_store")) return "📚";
  if (types.includes("art_gallery")) return "🎨";
  if (types.includes("museum")) return "🏛️";
  return "📍";
}

const nightMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#141b22" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#141b22" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7c867f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2b343c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7c867f" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1a22" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#17271c" }] },
];
