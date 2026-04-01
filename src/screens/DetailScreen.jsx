import { VIBES, ROUTE_COLORS } from "../utils/constants";

/**
 * DetailScreen — Week 4 (polished)
 *
 * Changes: content-container max-width, better mobile spacing,
 * button press effects, improved POI list layout
 */

export default function DetailScreen({
  route,
  routeIndex,
  isNight,
  origin,
  destination,
  onBack,
}) {
  if (!route) return null;

  const color = ROUTE_COLORS[routeIndex] || "#888";
  const minutes = Math.round(route.durationSeconds / 60);
  const km = (route.distanceMeters / 1000).toFixed(1);
  const allPois = route.pois || [];

  const streets = (route.steps || [])
    .map((s) => {
      const instr = s.navigationInstruction?.instructions || "";
      const match = instr.match(/onto\s+(.+)$/i) || instr.match(/on\s+(.+)$/i);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .filter((st, i, arr) => i === 0 || st !== arr[i - 1]);

  const cardClass = `rounded-2xl p-5 ${isNight ? "bg-night-card border border-night-border" : "bg-white border border-earth-200"}`;

  return (
    <div className={`min-h-screen pb-8 ${isNight ? "bg-night-bg" : "bg-earth-50"}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b backdrop-blur-sm ${isNight ? "border-night-border bg-night-bg/90" : "border-earth-200 bg-earth-50/90"}`}>
        <button onClick={onBack} className={`text-xl p-1 btn-press ${isNight ? "text-earth-200" : "text-earth-800"}`}>←</button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <div className="min-w-0">
            <p className={`font-display text-lg truncate ${isNight ? "text-earth-200" : "text-earth-800"}`}>
              {route.name || "Route"}
            </p>
            <p className={`text-xs font-body ${isNight ? "text-night-muted" : "text-earth-400"}`}>
              {km} km · {minutes} min{route.source === "waypoint-injected" ? " · via waypoint" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 content-container space-y-4">
        {/* AI Narrative */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🧠</span>
            <p className="text-[11px] font-bold font-body text-vibe-green uppercase tracking-wider">AI Route Summary</p>
          </div>
          <p className={`text-[15px] font-body leading-relaxed ${isNight ? "text-night-text" : "text-earth-700"}`}>
            {route.narrative || "Route description is loading..."}
          </p>
          <p className={`text-[10px] font-body mt-3 italic ${isNight ? "text-night-muted/40" : "text-earth-300"}`}>
            Generated from verified Places API data. POIs confirmed via Google.
          </p>
        </div>

        {/* Vibe Scores */}
        <div className={cardClass}>
          <p className={`text-[11px] font-bold font-body uppercase tracking-wider mb-4 ${isNight ? "text-night-muted" : "text-earth-400"}`}>
            Vibe Scores
          </p>
          <div className="space-y-3.5">
            {VIBES.map((vibe) => {
              const score = route.scores?.[vibe.id];
              const available = score !== null && score !== undefined;
              const pct = available ? Math.min(100, (score / 5) * 100) : 0;
              return (
                <div key={vibe.id} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{vibe.icon}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold font-body mb-1 ${isNight ? "text-night-text" : "text-earth-800"}`}>{vibe.label}</p>
                    <div className={`h-2.5 rounded-full overflow-hidden ${isNight ? "bg-night-border" : "bg-earth-100"}`}>
                      {available ? (
                        <div className="score-bar-fill h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      ) : (
                        <div className="h-full flex items-center px-2">
                          <span className={`text-[9px] font-body ${isNight ? "text-night-muted" : "text-earth-300"}`}>Coming in v2</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm font-bold font-body w-8 text-right ${isNight ? "text-night-muted" : "text-earth-500"}`}>
                    {available ? score.toFixed(1) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Places Along Route */}
        {allPois.length > 0 && (
          <div className={cardClass}>
            <p className={`text-[11px] font-bold font-body uppercase tracking-wider mb-3 ${isNight ? "text-night-muted" : "text-earth-400"}`}>
              Along This Route ({allPois.length} places)
            </p>
            {allPois.slice(0, 10).map((poi, i) => (
              <div
                key={poi.id || i}
                className={`flex items-center gap-3 py-2.5 ${i < Math.min(allPois.length, 10) - 1 ? `border-b ${isNight ? "border-night-border" : "border-earth-100"}` : ""}`}
              >
                <span className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isNight ? "bg-night-bg" : "bg-earth-50"}`}>
                  {getPoiIcon(poi.types)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold font-body truncate ${isNight ? "text-earth-200" : "text-earth-800"}`}>{poi.name}</p>
                  <p className={`text-xs font-body capitalize ${isNight ? "text-night-muted" : "text-earth-400"}`}>{getTypeLabel(poi.types)}</p>
                </div>
                {poi.rating && (
                  <span className={`text-xs font-body flex-shrink-0 ${isNight ? "text-night-muted" : "text-earth-400"}`}>⭐ {poi.rating}</span>
                )}
              </div>
            ))}
            {allPois.length > 10 && (
              <p className={`text-xs font-body text-center pt-2 ${isNight ? "text-night-muted" : "text-earth-400"}`}>
                +{allPois.length - 10} more places nearby
              </p>
            )}
          </div>
        )}

        {/* Route Path */}
        {streets.length > 0 && (
          <div className={cardClass}>
            <p className={`text-[11px] font-bold font-body uppercase tracking-wider mb-3 ${isNight ? "text-night-muted" : "text-earth-400"}`}>Route Path</p>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {streets.slice(0, 8).map((street, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className={`text-sm font-body font-medium ${isNight ? "text-night-text" : "text-earth-700"}`}>{street}</span>
                  {i < Math.min(streets.length, 8) - 1 && <span className={`text-xs ${isNight ? "text-night-muted" : "text-earth-300"}`}>→</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action button */}
        <a
          href={buildMapsUrl(origin, destination, route)}
          target="_blank" rel="noopener noreferrer"
          className="block w-full py-4 rounded-xl text-white text-center text-base font-semibold font-body shadow-lg btn-press"
          style={{ backgroundColor: color, boxShadow: `0 4px 20px ${color}33` }}
        >
          Open in Google Maps →
        </a>
      </div>
    </div>
  );
}

function buildMapsUrl(origin, destination, route) {
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=walking`;
  if (route.waypointUsed) url += `&waypoints=${route.waypointUsed.latitude},${route.waypointUsed.longitude}`;
  return url;
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
  if (types.includes("bar")) return "🍺";
  return "📍";
}

function getTypeLabel(types) {
  if (!types) return "Place";
  const labels = { park: "Park", cafe: "Café", coffee_shop: "Coffee", restaurant: "Restaurant", bakery: "Bakery", book_store: "Bookstore", art_gallery: "Gallery", museum: "Museum", bar: "Bar" };
  for (const t of types) { if (labels[t]) return labels[t]; }
  return types[0]?.replace(/_/g, " ") || "Place";
}
