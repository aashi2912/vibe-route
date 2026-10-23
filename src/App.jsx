import { useState, useCallback } from "react";
import { isNightTime } from "./utils/geo";
import InputScreen from "./screens/InputScreen";
import ResultsScreen from "./screens/ResultsScreen";
import DetailScreen from "./screens/DetailScreen";
import WelcomeOverlay from "./components/WelcomeOverlay";
import NavigationScreen from "./screens/NavigationScreen";

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
    setSelectedVibes(SAMPLE.vibes);
    setOrigin(SAMPLE.origin);
    setDestination(SAMPLE.destination);
    setScreen("results");
  }, []);

  const handleSearch = useCallback(
    (searchOrigin, searchDest) => {
      setOrigin(searchOrigin);
      setDestination(searchDest);
      setScreen("results");

      if (!nightOverride && searchOrigin?.latitude) {
        setIsNight(isNightTime(searchOrigin.latitude));
      }
    },
    [nightOverride]
  );

  const handleViewDetail = useCallback((route, index) => {
    setDetailRoute(route);
    setDetailRouteIndex(index);
    setScreen("detail");
  }, []);

  const handleStartNav = useCallback(() => setScreen("navigate"), []);

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
          <WelcomeOverlay isNight={isNight} onTrySample={handleTrySample} />
          <InputScreen
            isNight={isNight}
            onToggleNight={toggleNight}
            selectedVibes={selectedVibes}
            onVibesChange={setSelectedVibes}
            onSearch={handleSearch}
            onTrySample={handleTrySample}
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
