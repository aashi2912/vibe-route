import { useState, useRef, useEffect } from "react";
import { VIBES, MAX_VIBE_SELECTIONS, MIN_WALKING_DISTANCE_M, MAX_WALKING_DISTANCE_M } from "../utils/constants";
import { distanceBetween } from "../utils/geo";

/**
 * InputScreen — with AI #2: Natural Language Vibe Input
 *
 * Users can either:
 * 1. Tap vibe chips (original flow)
 * 2. Type a natural description like "quiet walk through parks with coffee"
 *    → LLM parses it into vibe selections automatically
 *
 * The NLP input is additive — it sets the chips, user can still adjust manually.
 */

export default function InputScreen({
  isNight,
  onToggleNight,
  selectedVibes,
  onVibesChange,
  onSearch,
}) {
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // NLP state
  const [nlpText, setNlpText] = useState("");
  const [nlpParsing, setNlpParsing] = useState(false);
  const [nlpResult, setNlpResult] = useState(null); // "Detected: Green & Peaceful, Coffee Stops"

  const originRef = useRef(null);
  const destRef = useRef(null);
  const originAutocomplete = useRef(null);
  const destAutocomplete = useRef(null);

  // Initialize Google Places Autocomplete
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
      originAutocomplete.current = new window.google.maps.places.Autocomplete(
        originRef.current,
        { types: ["geocode", "establishment"] }
      );
      originAutocomplete.current.addListener("place_changed", () => {
        const place = originAutocomplete.current.getPlace();
        if (place.geometry?.location) {
          setOriginCoords({
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
          });
          setOriginText(place.formatted_address || place.name || "");
        }
      });
    }

    if (destRef.current && !destAutocomplete.current) {
      destAutocomplete.current = new window.google.maps.places.Autocomplete(
        destRef.current,
        { types: ["geocode", "establishment"] }
      );
      destAutocomplete.current.addListener("place_changed", () => {
        const place = destAutocomplete.current.getPlace();
        if (place.geometry?.location) {
          setDestCoords({
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
          });
          setDestText(place.formatted_address || place.name || "");
        }
      });
    }
  }

  function toggleVibe(vibeId) {
    // Clear NLP result when user manually toggles
    setNlpResult(null);
    onVibesChange((prev) => {
      if (prev.includes(vibeId)) {
        return prev.length > 1 ? prev.filter((v) => v !== vibeId) : prev;
      }
      if (prev.length >= MAX_VIBE_SELECTIONS) return prev;
      return [...prev, vibeId];
    });
  }

  // ─── AI #2: Parse natural language into vibes ───
  async function parseVibes() {
    if (!nlpText.trim() || nlpText.trim().length < 5) return;

    setNlpParsing(true);
    setNlpResult(null);

    try {
      const response = await fetch("/api/parse-vibes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlpText.trim() }),
      });

      const data = await response.json();

      if (data.vibes && data.vibes.length > 0) {
        onVibesChange(data.vibes.slice(0, MAX_VIBE_SELECTIONS));

        // Show what was detected
        const names = data.vibes
          .map((id) => VIBES.find((v) => v.id === id)?.label)
          .filter(Boolean);
        setNlpResult(`✨ Detected: ${names.join(", ")}`);
      } else {
        setNlpResult("Couldn't parse preferences — try the chips above");
      }
    } catch (err) {
      console.warn("NLP parse failed:", err);
      setNlpResult("AI unavailable — use the chips above");
    } finally {
      setNlpParsing(false);
    }
  }

  function handleNlpKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      parseVibes();
    }
  }

  function handleSubmit() {
    setValidationError(null);

    if (!originCoords || !destCoords) {
      setValidationError(
        "Please select both a starting point and destination from the suggestions."
      );
      return;
    }

    const distance = distanceBetween(originCoords, destCoords);

    if (distance < MIN_WALKING_DISTANCE_M) {
      setValidationError(
        "These locations are very close (under 500m). All walking routes will be similar."
      );
    }

    if (distance > MAX_WALKING_DISTANCE_M) {
      setValidationError(
        `That's a ${Math.round(distance / 1000)}km walk (over 1 hour). Consider transit for part of the journey.`
      );
    }

    onSearch(
      { ...originCoords, address: originText },
      { ...destCoords, address: destText }
    );
  }

  const inputClasses = `w-full py-4 px-10 rounded-xl border-[1.5px] text-[15px] font-body outline-none transition-colors ${
    isNight
      ? "bg-night-card border-night-border text-night-text placeholder:text-night-muted"
      : "bg-white border-earth-200 text-earth-800 placeholder:text-earth-400"
  }`;

  return (
    <div className="max-w-md mx-auto px-6 pt-10 pb-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={`text-[32px] font-display ${isNight ? "text-earth-200" : "text-earth-800"}`}>
            Vibe Route
          </h1>
          <p className={`text-sm font-body mt-1 ${isNight ? "text-night-muted" : "text-earth-500"}`}>
            Walk the way that feels right
          </p>
        </div>
        <button
          onClick={onToggleNight}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold font-body transition-colors ${
            isNight ? "bg-night-card text-night-muted" : "bg-earth-100 text-earth-500"
          }`}
        >
          {isNight ? "🌙 Night" : "☀️ Day"}
        </button>
      </div>

      {/* Origin / Destination */}
      <div className="mb-7 space-y-3">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-vibe-green border-2 border-vibe-green/20" />
          <input
            ref={originRef}
            value={originText}
            onChange={(e) => { setOriginText(e.target.value); setOriginCoords(null); }}
            placeholder="Where are you starting?"
            className={inputClasses}
          />
        </div>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded bg-vibe-orange border-2 border-vibe-orange/20" />
          <input
            ref={destRef}
            value={destText}
            onChange={(e) => { setDestText(e.target.value); setDestCoords(null); }}
            placeholder="Where are you going?"
            className={inputClasses}
          />
        </div>
      </div>

      {/* Vibe selector */}
      <div className="mb-4">
        <p className={`text-xs font-semibold font-body uppercase tracking-wider mb-3 ${isNight ? "text-night-muted" : "text-earth-500"}`}>
          What matters to you? <span className="font-normal normal-case">(pick up to 3)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {VIBES.map((vibe) => {
            const isSelected = selectedVibes.includes(vibe.id);
            return (
              <button
                key={vibe.id}
                onClick={() => toggleVibe(vibe.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold font-body transition-all btn-press ${
                  isSelected
                    ? "bg-vibe-green text-white border-2 border-vibe-green"
                    : isNight
                    ? "bg-night-card text-night-text border-[1.5px] border-night-border"
                    : "bg-earth-50 text-earth-600 border-[1.5px] border-earth-200"
                } ${vibe.v1Limited ? "opacity-60" : ""}`}
              >
                <span>{vibe.icon}</span>
                {vibe.label}
              </button>
            );
          })}
        </div>
        {selectedVibes.includes("lit") && (
          <p className={`text-xs mt-2 font-body ${isNight ? "text-night-muted" : "text-earth-400"}`}>
            ⓘ {VIBES.find((v) => v.id === "lit")?.v1Message}
          </p>
        )}
      </div>

      {/* ─── AI #2: Natural Language Input ─── */}
      <div className="mb-6">
        <div className={`flex items-center gap-2 mb-2`}>
          <div className={`flex-1 h-px ${isNight ? "bg-night-border" : "bg-earth-200"}`} />
          <span className={`text-[11px] font-body ${isNight ? "text-night-muted" : "text-earth-400"}`}>or describe your ideal walk</span>
          <div className={`flex-1 h-px ${isNight ? "bg-night-border" : "bg-earth-200"}`} />
        </div>

        <div className="relative">
          <input
            value={nlpText}
            onChange={(e) => { setNlpText(e.target.value); setNlpResult(null); }}
            onKeyDown={handleNlpKeyDown}
            onBlur={() => { if (nlpText.trim().length >= 5) parseVibes(); }}
            placeholder={`"quiet walk through parks with coffee stops"`}
            className={`w-full py-3 px-4 pr-12 rounded-xl border-[1.5px] text-sm font-body outline-none transition-colors italic ${
              isNight
                ? "bg-night-card border-night-border text-night-text placeholder:text-night-muted/60"
                : "bg-earth-50 border-earth-200 text-earth-700 placeholder:text-earth-300"
            }`}
          />
          {nlpParsing ? (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-vibe-green border-t-transparent rounded-full animate-spin" />
          ) : nlpText.trim().length >= 5 ? (
            <button
              onClick={parseVibes}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-body text-vibe-green px-2 py-1 rounded-lg hover:bg-vibe-green/10 transition-colors"
            >
              Parse
            </button>
          ) : null}
        </div>

        {/* NLP result feedback */}
        {nlpResult && (
          <p className={`text-xs font-body mt-2 ${nlpResult.startsWith("✨") ? "text-vibe-green" : isNight ? "text-night-muted" : "text-earth-400"}`}>
            {nlpResult}
          </p>
        )}
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-body">
          ⚠️ {validationError}
        </div>
      )}

      {/* Search button */}
      <button
        onClick={handleSubmit}
        className="w-full py-4 rounded-xl bg-vibe-green text-white text-base font-semibold font-body shadow-lg shadow-vibe-green/20 btn-press"
      >
        Find my vibe routes
      </button>

      {/* AI features badge */}
      <div className="flex flex-wrap gap-1.5 justify-center mt-4">
        {["🧠 AI-scored routes", "💬 Natural language input", "📝 Route narratives"].map(
          (label) => (
            <span
              key={label}
              className={`text-[10px] font-body px-2.5 py-1 rounded-full ${
                isNight ? "bg-night-card text-night-muted" : "bg-earth-100 text-earth-400"
              }`}
            >
              {label}
            </span>
          )
        )}
      </div>

      <p className={`text-[10px] text-center mt-6 font-body ${isNight ? "text-night-muted/50" : "text-earth-300"}`}>
        Walking routes are in beta and may be missing sidewalks or pedestrian paths in some areas.
      </p>
    </div>
  );
}
