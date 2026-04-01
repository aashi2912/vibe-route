import { useState, useCallback } from "react";
import { isNightTime } from "./utils/geo";
import InputScreen from "./screens/InputScreen";
import ResultsScreen from "./screens/ResultsScreen";
import DetailScreen from "./screens/DetailScreen";

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
  const [isNight, setIsNight] = useState(() => isNightTime(43.65));
  const [nightOverride, setNightOverride] = useState(false);

  // Detail screen state
  const [detailRoute, setDetailRoute] = useState(null);
  const [detailRouteIndex, setDetailRouteIndex] = useState(0);

  const toggleNight = useCallback(() => {
    setIsNight((prev) => !prev);
    setNightOverride(true);
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

  const handleBack = useCallback(() => {
    if (screen === "detail") {
      setScreen("results");
      setDetailRoute(null);
    } else {
      setScreen("input");
    }
  }, [screen]);

  return (
    <div className={`min-h-screen theme-transition ${isNight ? "bg-night-bg" : "bg-earth-50"}`}>
      {screen === "input" && (
        <InputScreen
          isNight={isNight}
          onToggleNight={toggleNight}
          selectedVibes={selectedVibes}
          onVibesChange={setSelectedVibes}
          onSearch={handleSearch}
        />
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
        />
      )}
    </div>
  );
}
