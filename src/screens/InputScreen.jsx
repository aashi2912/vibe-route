import { useState, useRef, useEffect } from "react";
import { VIBES, MAX_VIBE_SELECTIONS, MIN_WALKING_DISTANCE_M, MAX_WALKING_DISTANCE_M } from "../utils/constants";
import { distanceBetween } from "../utils/geo";

/**
 * InputScreen — the landing / route planner.
 * Direction 1 "Refine": warm paper, day-first, pin-marker inputs,
 * vibe chips with real emoji, natural-language input, and a sample path.
 */
export default function InputScreen({
  isNight,
  onToggleNight,
  selectedVibes,
  onVibesChange,
  onSearch,
  onTrySample,   // optional: fills a demo route so first-timers see value
}) {
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [locating, setLocating] = useState(false);

  const [nlpText, setNlpText] = useState("");
  const [nlpParsing, setNlpParsing] = useState(false);
  const [nlpResult, setNlpResult] = useState(null);

  const originRef = useRef(null);
  const destRef = useRef(null);
  const originAutocomplete = useRef(null);
  const destAutocomplete = useRef(null);

  useEffect(() => {
    if (!window.google?.maps?.places) {
      const timer = setTimeout(() => initAutocomplete(), 2000);
      return () => clearTimeout(timer);
    }
    initAutocomplete();
  }, []);

  function initAutocomplete() {
    if (!window.google?.maps?.places) return;
    if (originRef.current && !originAutocomplete.current) {
      originAutocomplete.current = new window.google.maps.places.Autocomplete(originRef.current, { types: ["geocode", "establishment"] });
      originAutocomplete.current.addListener("place_changed", () => {
        const place = originAutocomplete.current.getPlace();
        if (place.geometry?.location) {
          setOriginCoords({ latitude: place.geometry.location.lat(), longitude: place.geometry.location.lng() });
          setOriginText(place.formatted_address || place.name || "");
        }
      });
    }
    if (destRef.current && !destAutocomplete.current) {
      destAutocomplete.current = new window.google.maps.places.Autocomplete(destRef.current, { types: ["geocode", "establishment"] });
      destAutocomplete.current.addListener("place_changed", () => {
        const place = destAutocomplete.current.getPlace();
        if (place.geometry?.location) {
          setDestCoords({ latitude: place.geometry.location.lat(), longitude: place.geometry.location.lng() });
          setDestText(place.formatted_address || place.name || "");
        }
      });
    }
  }

  function toggleVibe(vibeId) {
    setNlpResult(null);
    onVibesChange((prev) => {
      if (prev.includes(vibeId)) return prev.length > 1 ? prev.filter((v) => v !== vibeId) : prev;
      if (prev.length >= MAX_VIBE_SELECTIONS) return prev;
      return [...prev, vibeId];
    });
  }

  async function parseVibes() {
    if (!nlpText.trim() || nlpText.trim().length < 5) return;
    setNlpParsing(true); setNlpResult(null);
    try {
      const response = await fetch("/api/parse-vibes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlpText.trim() }),
      });
      const data = await response.json();
      if (data.vibes && data.vibes.length > 0) {
        onVibesChange(data.vibes.slice(0, MAX_VIBE_SELECTIONS));
        const names = data.vibes.map((id) => VIBES.find((v) => v.id === id)?.label).filter(Boolean);
        setNlpResult(`✨ Detected: ${names.join(", ")}`);
      } else {
        setNlpResult("Couldn't read that — tap the signals above instead");
      }
    } catch {
      setNlpResult("AI unavailable — tap the signals above instead");
    } finally { setNlpParsing(false); }
  }

  function handleNlpKeyDown(e) { if (e.key === "Enter") { e.preventDefault(); parseVibes(); } }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setValidationError("Your browser can't share location. Type a starting point instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOriginCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setOriginText("My location");
        setLocating(false);
      },
      () => {
        setLocating(false);
        setValidationError("Couldn't get your location. Type a starting point instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleSubmit() {
    setValidationError(null);
    if (!originCoords || !destCoords) {
      setValidationError("Pick a start and destination from the suggestions so we can map real routes.");
      return;
    }
    const distance = distanceBetween(originCoords, destCoords);
    if (distance < 50) {
      setValidationError("Your start and destination are the same place. Pick two different points.");
      return; // hard stop — no route to compute
    }
    if (distance < MIN_WALKING_DISTANCE_M) {
      setValidationError("Those points are under 500m apart — every route will look about the same.");
    }
    if (distance > MAX_WALKING_DISTANCE_M) {
      setValidationError(`That's a ${Math.round(distance / 1000)}km walk (over an hour). Try transit for part of it.`);
    }
    onSearch({ ...originCoords, address: originText }, { ...destCoords, address: destText });
  }

  const field = `w-full py-3.5 pl-11 pr-4 rounded-xl border-[1.5px] text-[15px] font-body outline-none transition-colors ${
    isNight ? "bg-night-card border-night-border text-night-text placeholder:text-night-muted"
            : "bg-white border-earth-200 text-earth-800 placeholder:text-earth-400 shadow-card"}`;

  return (
    <div className="max-w-md mx-auto px-6 pt-10 pb-10">
      {/* Header */}
      <div className="flex justify-between items-start mb-7">
        <div>
          <h1 className={`text-[34px] leading-none font-display tracking-tight ${isNight ? "text-night-text" : "text-earth-800"}`}>
            Vibe Route
          </h1>
          <p className={`text-sm font-body mt-2 italic ${isNight ? "text-night-muted" : "text-earth-500"}`}>
            Walk the way that feels right
          </p>
        </div>
        <button onClick={onToggleNight}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold font-body transition-colors ${
            isNight ? "bg-night-card text-night-muted" : "bg-earth-100 text-earth-500"}`}>
          {isNight ? "🌙 Night" : "☀️ Day"}
        </button>
      </div>

      {/* Origin / destination */}
      <div className="space-y-2.5">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-vibe-green ring-4 ring-vibe-green/15" />
          <input ref={originRef} value={originText}
            onChange={(e) => { setOriginText(e.target.value); setOriginCoords(null); }}
            placeholder="Starting point" className={field + " pr-24"} />
          <button type="button" onClick={useMyLocation} disabled={locating}
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold font-body px-2.5 py-1.5 rounded-lg btn-press transition-colors ${
              isNight ? "text-vibe-green bg-vibe-green/10" : "text-vibe-green bg-vibe-green/10"}`}>
            {locating ? "…" : "📍 Me"}
          </button>
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 bg-vibe-orange ring-4 ring-vibe-orange/15"
            style={{ borderRadius: "50% 50% 50% 2px", transform: "translateY(-50%) rotate(45deg)" }} />
          <input ref={destRef} value={destText}
            onChange={(e) => { setDestText(e.target.value); setDestCoords(null); }}
            placeholder="Destination" className={field} />
        </div>
      </div>

      {/* Vibe signals */}
      <div className="mt-6">
        <p className={`text-[13px] font-body mb-3 ${isNight ? "text-night-muted" : "text-earth-500"}`}>
          What matters on this walk? <span className="opacity-70">pick up to 3</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {VIBES.map((vibe) => {
            const on = selectedVibes.includes(vibe.id);
            return (
              <button key={vibe.id} onClick={() => toggleVibe(vibe.id)}
                aria-pressed={on}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13.5px] font-semibold font-body transition-all btn-press ${
                  on ? "bg-vibe-green text-white border-[1.5px] border-vibe-green shadow-cta"
                     : isNight ? "bg-night-card text-night-text border-[1.5px] border-night-border"
                               : "bg-white text-earth-600 border-[1.5px] border-earth-200"}`}>
                <span>{vibe.icon}</span>{vibe.label}
              </button>
            );
          })}
        </div>
        {selectedVibes.includes("lit") && (
          <p className={`text-xs mt-2.5 font-body leading-snug ${isNight ? "text-night-muted" : "text-earth-400"}`}>
            ⓘ {VIBES.find((v) => v.id === "lit")?.proxyMessage}
          </p>
        )}
      </div>

      {/* Natural-language input */}
      <div className="mt-5">
        <div className="flex items-center gap-2 mb-2">
          <span className={`flex-1 h-px ${isNight ? "bg-night-border" : "bg-earth-200"}`} />
          <span className={`text-[11px] font-body ${isNight ? "text-night-muted" : "text-earth-400"}`}>or describe it in words</span>
          <span className={`flex-1 h-px ${isNight ? "bg-night-border" : "bg-earth-200"}`} />
        </div>
        <div className="relative">
          <input value={nlpText}
            onChange={(e) => { setNlpText(e.target.value); setNlpResult(null); }}
            onKeyDown={handleNlpKeyDown}
            onBlur={() => { if (nlpText.trim().length >= 5) parseVibes(); }}
            placeholder={`"a quiet walk through parks with a coffee stop"`}
            className={`w-full py-3 px-4 pr-16 rounded-xl border-[1.5px] text-sm font-body italic outline-none transition-colors ${
              isNight ? "bg-night-card border-night-border text-night-text placeholder:text-night-muted/70"
                      : "bg-earth-100 border-earth-200 text-earth-700 placeholder:text-earth-400"}`} />
          {nlpParsing ? (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-vibe-green border-t-transparent rounded-full animate-spin" />
          ) : nlpText.trim().length >= 5 ? (
            <button onClick={parseVibes}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold font-body text-vibe-green px-2.5 py-1 rounded-lg hover:bg-vibe-green/10 transition-colors">Read it</button>
          ) : null}
        </div>
        {nlpResult && (
          <p className={`text-xs font-body mt-2 ${nlpResult.startsWith("✨") ? "text-vibe-green font-semibold" : isNight ? "text-night-muted" : "text-earth-400"}`}>{nlpResult}</p>
        )}
      </div>

      {validationError && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-body">
          ⚠️ {validationError}
        </div>
      )}

      <button onClick={handleSubmit}
        className="mt-6 w-full py-4 rounded-xl bg-vibe-green text-white text-[15px] font-bold font-body shadow-cta btn-press">
        Find my walk
      </button>

      {/* Sample path for first-timers */}
      {onTrySample && (
        <button onClick={onTrySample}
          className={`mt-3 w-full py-3 rounded-xl text-sm font-semibold font-body border-[1.5px] btn-press transition-colors ${
            isNight ? "border-night-border text-night-text bg-night-card" : "border-earth-200 text-earth-600 bg-white"}`}>
          ✨ Try a sample walk in Toronto
        </button>
      )}

      <p className={`text-[11px] text-center mt-6 font-body leading-relaxed ${isNight ? "text-night-muted/60" : "text-earth-300"}`}>
        Walking routes are in beta — a few areas may be missing sidewalks or paths.
      </p>
    </div>
  );
}
