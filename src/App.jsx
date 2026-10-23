import { useState, useCallback, useEffect } from "react";
import { isNightTime } from "./utils/geo";
import InputScreen from "./screens/InputScreen";
import ResultsScreen from "./screens/ResultsScreen";
import DetailScreen from "./screens/DetailScreen";
import WelcomeOverlay from "./components/WelcomeOverlay";
// analytics
import NavigationScreen from "./screens/NavigationScreen";
import GuidedTour from "./components/GuidedTour";
import { track } from "./utils/analytics";

/**
 * App — Root component (Week 3)
 *
 * Manages:
 * - Screen state (input → results → detail)
 * - Route data (passed between screens)
 * - Day/night mode (auto-detected, manually overridable)
 * - Selected vibes
 * - Selected route for detail view
 */
export default function App() {
  const [screen, setScreen] = useState("input");
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [selectedVibes, setSelectedVibes] = useState(["green"]);

  // Day/night mode
  // Day-first: a walking app should feel bright and outdoors on first open.
  // Night mode stays available via the toggle and auto-engages on a real night search.
  const [isNight, setIsNight] = useState(false);
  const [nightOverride, setNightOverride] = useState(false);

  // Detail screen state
  const [detailRoute, setDetailRoute] = useState(null);
  const [detailRouteIndex, setDetailRouteIndex] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);

  // Restore a shared walk from the URL (?o=lat,lng&d=lat,lng&v=green,coffee).
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const o = q.get("o"), d = q.get("d");
      if (!o || !d) return;
      const [olat, olng] = o.split(",").map(Number);
      const [dlat, dlng] = d.split(",").map(Number);
      if (![olat, olng, dlat, dlng].every(Number.isFinite)) return;
      const vibes = (q.get("v") || "green").split(",").filter((v) => ["green","coffee","local","lit"].includes(v));
      setSelectedVibes(vibes.length ? vibes.slice(0, 3) : ["green"]);
      setOrigin({ latitude: olat, longitude: olng, address: q.get("oa") || "Shared start" });
      setDestination({ latitude: dlat, longitude: dlng, address: q.get("da") || "Shared destination" });
      setScreen("results");
    } catch { /* malformed link — ignore, show input */ }
  }, []);

  const toggleNight = useCallback(() => {
    setIsNight((prev) => !prev);
    setNightOverride(true);
  }, []);

  const SAMPLE = {
    origin: { latitude: 43.6469, longitude: -79.4208, address: "Trinity Bellwoods Park, Toronto" },
    destination: { latitude: 43.6542, longitude: -79.4003, address: "Kensington Market, Toronto" },
    vibes: ["green", "coffee", "local"],
  };

  const handleTrySample = useCallback(() => {
    track("route_search", { input_mode: "sample", vibes: SAMPLE.vibes, has_nl: false, is_sample: true });
    setSelectedVibes(SAMPLE.vibes);
    setOrigin(SAMPLE.origin);
    setDestination(SAMPLE.destination);
    setScreen("results");
  }, []);

  const handleSearch = useCallback(
    (searchOrigin, searchDest) => {
      setOrigin(searchOrigin);
      setDestination(searchDest);
      track("route_search", { input_mode: searchOrigin.address === "My location" ? "geo" : "typed", vibes: selectedVibes, has_nl: false });
      setScreen("results");

      if (!nightOverride && searchOrigin?.latitude) {
        setIsNight(isNightTime(searchOrigin.latitude));
      }
    },
    [nightOverride, selectedVibes]
  );

  const handleViewDetail = useCallback((route, index) => {
    const topVibe = selectedVibes[0];
    track("route_viewed", { rank: index, vibe_score: route.scores?.[topVibe] ?? null, waypoint: route.source === "waypoint-injected" });
    setDetailRoute(route);
    setDetailRouteIndex(index);
    setScreen("detail");
  }, []);

  const handleStartNav = useCallback(() => { track("route_selected", { via: "start_walking" }); setScreen("navigate"); }, []);

  const handleBack = useCallback(() => {
    if (screen === "navigate") {
      setScreen("detail");
    } else if (screen === "detail") {
      setScreen("results");
      setDetailRoute(null);
    } else {
      setScreen("input");
    }
  }, [screen]);

  return (
    <div className={`min-h-screen theme-transition ${isNight ? "bg-night-bg" : "bg-earth-50"}`}>
      {screen === "input" && (
        <>
          <WelcomeOverlay isNight={isNight} onTrySample={handleTrySample} onTakeTour={() => setTourOpen(true)} />
          <GuidedTour isNight={isNight} open={tourOpen} onClose={() => setTourOpen(false)} onFinishSample={handleTrySample} />
          <InputScreen
            isNight={isNight}
            onToggleNight={toggleNight}
            selectedVibes={selectedVibes}
            onVibesChange={setSelectedVibes}
            onSearch={handleSearch}
            onTrySample={handleTrySample}
            onTakeTour={() => setTourOpen(true)}
          />
        </>
      )}

      {screen === "results" && (
        <ResultsScreen
          isNight={isNight}
          origin={origin}
          destination={destination}
          selectedVibes={selectedVibes}
          onBack={handleBack}
          onViewDetail={handleViewDetail}
        />
      )}

      {screen === "detail" && (
        <DetailScreen
          route={detailRoute}
          routeIndex={detailRouteIndex}
          isNight={isNight}
          origin={origin}
          destination={destination}
          selectedVibes={selectedVibes}
          onBack={handleBack}
          onStartNav={handleStartNav}
        />
      )}

      {screen === "navigate" && (
        <NavigationScreen
          route={detailRoute}
          routeIndex={detailRouteIndex}
          isNight={isNight}
          origin={origin}
          destination={destination}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
