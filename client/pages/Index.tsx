import { useState, useCallback, useEffect, useRef } from "react";
import { Place, PlacesResponse } from "@shared/places";
import Map from "@/components/Map";
import Legend from "@/components/Legend";
import RadiusControl from "@/components/RadiusControl";
import LoadingOverlay from "@/components/LoadingOverlay";
import ResultsList from "@/components/ResultsList";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Default coordinates (London)
const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278];
const DEFAULT_ZOOM = 13;
const DEFAULT_RADIUS = 2000;

export default function Index() {
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [searchRadius, setSearchRadius] = useState(DEFAULT_RADIUS);
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>();

  // Calculate place counts by category
  const placeCounts = places.reduce(
    (acc, place) => {
      acc[place.category] = (acc[place.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Track current fetch request to prevent multiple concurrent requests
  const currentFetchRef = useRef<AbortController | null>(null);

  // Fetch places from API with retry logic
  const fetchPlaces = useCallback(
    async (lat: number, lon: number, radius: number, retryCount = 0) => {
      // Abort any previous request
      if (currentFetchRef.current) {
        currentFetchRef.current.abort();
      }

      setIsLoading(true);

      try {
        console.log(
          `Fetching places for lat: ${lat}, lon: ${lon}, radius: ${radius}m`,
        );

        // Validate input parameters
        if (
          !lat ||
          !lon ||
          !radius ||
          isNaN(lat) ||
          isNaN(lon) ||
          isNaN(radius)
        ) {
          throw new Error("Invalid search parameters");
        }

        const controller = new AbortController();
        currentFetchRef.current = controller;

        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const url = `/api/places?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&radius=${encodeURIComponent(radius)}`;
        console.log(`Making request to: ${url}`);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        clearTimeout(timeoutId);
        currentFetchRef.current = null;

        if (!response.ok) {
          throw new Error(
            `API error: ${response.status} ${response.statusText}`,
          );
        }

        const data: PlacesResponse = await response.json();
        console.log(`Successfully fetched ${data.places.length} places`);

        setPlaces(data.places);
        setHasSearched(true);
        setSelectedPlaceId(undefined);

        toast.success(
          `Found ${data.places.length} nearby services within ${(radius / 1000).toFixed(1)}km`,
        );
      } catch (error) {
        currentFetchRef.current = null;
        console.error("Error fetching places:", error);

        // Don't retry if request was aborted
        if ((error as Error).name === "AbortError") {
          console.log("Request was aborted");
          return;
        }

        // Retry logic for network errors
        if (retryCount < 2) {
          console.log(`Retrying... attempt ${retryCount + 1}`);
          toast.info(`Connection issue, retrying... (${retryCount + 1}/3)`);
          setTimeout(
            () => {
              fetchPlaces(lat, lon, radius, retryCount + 1);
            },
            1000 * (retryCount + 1),
          );
          return;
        }

        // Handle different error types
        let errorMessage = "Failed to fetch nearby services. ";
        if (error instanceof TypeError && error.message.includes("fetch")) {
          errorMessage +=
            "Network connection issue. Please check your connection and try again.";
        } else if (
          error instanceof Error &&
          error.message === "Invalid search parameters"
        ) {
          errorMessage +=
            "Invalid search location. Please try clicking a different area.";
        } else {
          errorMessage += "Please try again in a moment.";
        }

        toast.error(errorMessage);
        setPlaces([]);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Check network status
  const checkNetworkStatus = useCallback(() => {
    if (!navigator.onLine) {
      toast.error(
        "You appear to be offline. Please check your internet connection.",
      );
      return false;
    }
    return true;
  }, []);

  // Handle map click
  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      console.log(`Map clicked at: lat=${lat}, lon=${lon}`);

      // Validate coordinates
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
        console.error("Invalid coordinates:", { lat, lon });
        toast.error("Invalid location coordinates. Please try again.");
        return;
      }

      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        console.error("Coordinates out of range:", { lat, lon });
        toast.error("Location coordinates are out of range. Please try again.");
        return;
      }

      if (!checkNetworkStatus()) return;

      setMapCenter([lat, lon]);
      fetchPlaces(lat, lon, searchRadius);
    },
    [fetchPlaces, searchRadius, checkNetworkStatus],
  );

  // Handle location found
  const handleLocationFound = useCallback(
    (lat: number, lon: number) => {
      if (!checkNetworkStatus()) return;
      setMapCenter([lat, lon]);
      setMapZoom(14);
      fetchPlaces(lat, lon, searchRadius);
      toast.success("Location found! Searching for nearby services...");
    },
    [fetchPlaces, searchRadius, checkNetworkStatus],
  );

  // Handle radius change
  const handleRadiusChange = useCallback(
    (newRadius: number) => {
      setSearchRadius(newRadius);
      if (hasSearched && checkNetworkStatus()) {
        fetchPlaces(mapCenter[0], mapCenter[1], newRadius);
      }
    },
    [fetchPlaces, mapCenter, hasSearched, checkNetworkStatus],
  );

  // Handle refresh search
  const handleRefreshSearch = useCallback(() => {
    if (hasSearched && checkNetworkStatus()) {
      fetchPlaces(mapCenter[0], mapCenter[1], searchRadius);
    }
  }, [fetchPlaces, mapCenter, searchRadius, hasSearched, checkNetworkStatus]);

  // Handle place selection from results list
  const handlePlaceClick = useCallback((place: Place) => {
    setSelectedPlaceId(place.id);
    setMapCenter([place.lat, place.lon]);
    setMapZoom(16); // Zoom in when selecting a place
  }, []);

  // Get user location on mount
  useEffect(() => {
    // Check network first
    if (!checkNetworkStatus()) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          setMapZoom(14);
          fetchPlaces(latitude, longitude, searchRadius);
          toast.success("Location found! Showing nearby services...");
        },
        (error) => {
          console.log("Geolocation error on startup:", error);

          // Provide user feedback based on error type
          let message = "";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message =
                "Location access denied. Using default location (London). Click anywhere on the map to search other areas.";
              break;
            case error.POSITION_UNAVAILABLE:
              message =
                "Location unavailable. Using default location (London). Click anywhere on the map to search.";
              break;
            case error.TIMEOUT:
              message =
                "Location request timed out. Using default location (London). You can click the location button or click on the map.";
              break;
            default:
              message =
                "Using default location (London). Click anywhere on the map or use the location button to search your area.";
              break;
          }

          toast.info(message);
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000,
        },
      );
    } else {
      toast.info(
        "Geolocation not supported. Click anywhere on the map to search for services.",
      );
    }
  }, [fetchPlaces, searchRadius, checkNetworkStatus]);

  // Listen for network status changes
  useEffect(() => {
    const handleOnline = () => {
      toast.success("Connection restored! You can now search for services.");
    };

    const handleOffline = () => {
      toast.error("Connection lost. Please check your internet connection.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-10 flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">🌍</span>
              </div>
              <div>
                <h1 className="text-lg font-bold">ServiceFinder</h1>
                <p className="text-xs text-gray-400 hidden sm:block">
                  Find essential services nearby
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasSearched && (
                <div className="hidden sm:block text-xs text-gray-400">
                  {places.length} services found
                </div>
              )}
              <Button
                onClick={handleRefreshSearch}
                disabled={!hasSearched || isLoading}
                variant="outline"
                size="sm"
                className="text-gray-300 border-gray-600 hover:bg-gray-800"
              >
                <svg
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="hidden sm:inline ml-1">Refresh</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row relative">
        <div className="h-full flex-1 flex flex-col lg:flex-row">
          {/* Mobile Controls - Top Panel */}
          <div className="lg:hidden bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 p-3">
            <div className="flex gap-3 overflow-x-auto">
              <div className="flex-shrink-0">
                <RadiusControl
                  radius={searchRadius}
                  onRadiusChange={handleRadiusChange}
                  isLoading={isLoading}
                />
              </div>
              <div className="flex-shrink-0">
                <Legend placeCounts={placeCounts} />
              </div>
            </div>
          </div>

          {/* Desktop Left Sidebar - Controls */}
          <div className="hidden lg:flex w-80 bg-gray-900/50 backdrop-blur-sm border-r border-gray-800 flex-col">
            {/* Instructions */}
            <div className="p-4 border-b border-gray-800">
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
                <h3 className="text-blue-300 font-semibold text-sm mb-2 flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  How to use
                </h3>
                <ul className="text-blue-200 text-xs space-y-1">
                  <li>• Click anywhere on the map to search</li>
                  <li>• Use the "📍" button for your location</li>
                  <li>• Adjust search radius as needed</li>
                  <li>• Click markers for details</li>
                </ul>
              </div>
            </div>

            {/* Controls */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <RadiusControl
                radius={searchRadius}
                onRadiusChange={handleRadiusChange}
                isLoading={isLoading}
              />

              <Legend placeCounts={placeCounts} />

              {/* Statistics */}
              {hasSearched && (
                <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
                  <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    Search Results
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total found:</span>
                      <span className="text-white font-semibold">
                        {places.length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Search radius:</span>
                      <span className="text-white font-semibold">
                        {(searchRadius / 1000).toFixed(1)}km
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Container */}
          <div className="flex-1 relative h-full">
            <Map
              center={mapCenter}
              zoom={mapZoom}
              places={places}
              searchRadius={searchRadius}
              onMapClick={handleMapClick}
              onLocationFound={handleLocationFound}
              onPlaceClick={handlePlaceClick}
              selectedPlaceId={selectedPlaceId}
            />

            <LoadingOverlay isVisible={isLoading} />

            {/* Welcome overlay for first-time users */}
            {!hasSearched && !isLoading && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1500]">
                <div className="bg-gray-900/95 border border-gray-700 rounded-xl p-8 max-w-md text-center shadow-2xl">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🌍</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-3">
                    Welcome to ServiceFinder
                  </h2>
                  <p className="text-gray-300 text-sm mb-4">
                    Discover essential services around you. Get started by:
                  </p>
                  <div className="text-left text-gray-300 text-sm mb-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400">📍</span>
                      <span>Using your current location (recommended)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400">🗺️</span>
                      <span>Clicking anywhere on the map</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button
                      onClick={() => {
                        const mapElement =
                          document.querySelector(".leaflet-container");
                        if (mapElement) {
                          const button = mapElement.querySelector(
                            'button[title="Get my location"]',
                          ) as HTMLButtonElement;
                          if (button) button.click();
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 w-full"
                    >
                      📍 Use My Location
                    </Button>
                    <Button
                      onClick={() =>
                        handleLocationFound(mapCenter[0], mapCenter[1])
                      }
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800 w-full"
                    >
                      🗺️ Explore London (Default)
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Right Sidebar - Results List */}
          <div className="hidden lg:flex lg:h-full lg:max-h-full lg:overflow-hidden">
            <ResultsList
              places={places}
              onPlaceClick={handlePlaceClick}
              selectedPlaceId={selectedPlaceId}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
