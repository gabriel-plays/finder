import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Place, PLACE_CATEGORIES } from "@shared/places";
import { toast } from "sonner";

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapProps {
  center: [number, number];
  zoom: number;
  places: Place[];
  searchRadius: number;
  onMapClick: (lat: number, lon: number) => void;
  onLocationFound?: (lat: number, lon: number) => void;
  onPlaceClick?: (place: Place) => void;
  selectedPlaceId?: string;
}

// Helper function to calculate route using OpenRouteService
async function calculateRoute(start: [number, number], end: [number, number]) {
  try {
    // Using public OSRM demo server (no API key needed)
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        coordinates: route.geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]],
        ), // Flip lat/lon
        distance: route.distance, // Distance in meters
        duration: route.duration, // Duration in seconds
      };
    }
    return null;
  } catch (error) {
    console.error("Error calculating route:", error);
    return null;
  }
}

// Create custom icons for each category
const createCustomIcon = (category: keyof typeof PLACE_CATEGORIES) => {
  const config = PLACE_CATEGORIES[category];
  return L.divIcon({
    className: "custom-div-icon",
    html: `
      <div style="
        background-color: ${config.color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        ${config.icon}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const icons = {
  healthcare: createCustomIcon("healthcare"),
  transport: createCustomIcon("transport"),
  education: createCustomIcon("education"),
};

export default function Map({
  center,
  zoom,
  places,
  searchRadius,
  onMapClick,
  onLocationFound,
  onPlaceClick,
  selectedPlaceId,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const searchCenterRef = useRef<[number, number]>(center); // Track the original search center

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) {
      console.error("Map container ref not found");
      return;
    }

    console.log("Initializing Leaflet map...");

    try {
      // Create map with dark theme
      mapInstanceRef.current = L.map(mapRef.current, {
        center,
        zoom,
        zoomControl: false,
      });

      console.log("Map instance created successfully");
    } catch (error) {
      console.error("Error creating map:", error);
      return;
    }

    // Add dark theme tile layer with fallback
    try {
      const tileLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
        },
      );

      tileLayer.on("tileerror", () => {
        console.warn("Dark tile layer failed, trying fallback...");
        // Add fallback to OpenStreetMap
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 20,
          attribution:
            '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
        }).addTo(mapInstanceRef.current);
      });

      tileLayer.addTo(mapInstanceRef.current);
      console.log("Dark tile layer added successfully");
    } catch (error) {
      console.error("Error adding tile layer:", error);
      // Fallback to basic OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20,
        attribution:
          '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
      }).addTo(mapInstanceRef.current);
    }

    // Add zoom control to top right
    L.control.zoom({ position: "topright" }).addTo(mapInstanceRef.current);

    // Initialize marker layers
    markersRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    // Map click handler
    mapInstanceRef.current.on("click", (e) => {
      // Clear existing route
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }

      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    console.log("Map initialization completed");

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map center and zoom
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center, zoom]);

  // Update search radius circle and track search center
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Update the search center reference to always track the original search location
    searchCenterRef.current = center;

    // Remove existing circle
    if (circleRef.current) {
      circleRef.current.remove();
    }

    // Remove existing center marker
    if (centerMarkerRef.current) {
      centerMarkerRef.current.remove();
    }

    // Clear existing route when center changes
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    // Add search radius circle
    circleRef.current = L.circle(center, {
      radius: searchRadius,
      fillColor: "#3b82f6",
      fillOpacity: 0.1,
      color: "#3b82f6",
      weight: 2,
      opacity: 0.5,
    }).addTo(mapInstanceRef.current);

    // Add center marker
    centerMarkerRef.current = L.marker(center, {
      icon: L.divIcon({
        className: "center-marker",
        html: `
          <div style="
            background-color: #ef4444;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            animation: pulse 2s infinite;
          "></div>
          <style>
            @keyframes pulse {
              0% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.2); opacity: 0.7; }
              100% { transform: scale(1); opacity: 1; }
            }
          </style>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(mapInstanceRef.current);
  }, [center, searchRadius]);

  // Update place markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    // Add markers for each place
    places.forEach((place) => {
      // Create icon with selection styling
      const isSelected = selectedPlaceId === place.id;
      const config = PLACE_CATEGORIES[place.category];

      const markerIcon = L.divIcon({
        className: "custom-div-icon",
        html: `
          <div style="
            background-color: ${config.color};
            width: ${isSelected ? "32px" : "24px"};
            height: ${isSelected ? "32px" : "24px"};
            border-radius: 50%;
            border: ${isSelected ? "3px solid #60a5fa" : "2px solid white"};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${isSelected ? "16px" : "12px"};
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            cursor: pointer;
            transform: ${isSelected ? "scale(1.1)" : "scale(1)"};
            transition: all 0.2s ease;
          ">
            ${config.icon}
          </div>
        `,
        iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
        iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
      });

      const marker = L.marker([place.lat, place.lon], {
        icon: markerIcon,
      });

      // Get place type info for popup
      const getPlaceTypeInfo = (place: Place) => {
        const { details, category } = place;

        if (category === "transport") {
          if (details.highway === "bus_stop")
            return { type: "Bus Stop", icon: "🚏" };
          if (details.amenity === "bus_station")
            return { type: "Bus Station", icon: "🚌" };
          if (details.public_transport === "platform")
            return { type: "Platform", icon: "🚉" };
          if (details.public_transport === "stop_position")
            return { type: "Stop Position", icon: "📍" };
          if (
            details.amenity === "railway" ||
            place.name.toLowerCase().includes("station")
          )
            return { type: "Railway Station", icon: "🚂" };
          return { type: "Transport Hub", icon: "🚇" };
        }

        if (category === "healthcare") {
          if (details.amenity === "hospital")
            return { type: "Hospital", icon: "🏥" };
          if (details.amenity === "clinic")
            return { type: "Clinic", icon: "🩺" };
          if (details.amenity === "pharmacy")
            return { type: "Pharmacy", icon: "💊" };
          if (details.amenity === "doctors")
            return { type: "Doctor's Office", icon: "👩‍⚕️" };
          return { type: "Healthcare", icon: "⚕️" };
        }

        if (category === "education") {
          if (details.amenity === "university")
            return { type: "University", icon: "🎓" };
          if (details.amenity === "college")
            return { type: "College", icon: "🏛️" };
          if (details.amenity === "school")
            return { type: "School", icon: "🏫" };
          if (details.amenity === "kindergarten")
            return { type: "Kindergarten", icon: "🧒" };
          return { type: "Educational", icon: "📚" };
        }

        return { type: "Facility", icon: "📍" };
      };

      const typeInfo = getPlaceTypeInfo(place);

      // Create popup content
      const popupContent = `
        <div class="p-3 min-w-64 bg-gray-900 text-white rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">${typeInfo.icon}</span>
            <h3 class="font-semibold text-sm">${place.name}</h3>
          </div>
          <div class="space-y-1 text-xs text-gray-300">
            <p><span class="text-gray-400">Type:</span> <span class="text-blue-300 font-medium">${typeInfo.type}</span></p>
            <p><span class="text-gray-400">Category:</span> ${PLACE_CATEGORIES[place.category].label}</p>
            ${place.distance ? `<p><span class="text-gray-400">Distance:</span> ${place.distance < 1000 ? place.distance + "m" : (place.distance / 1000).toFixed(1) + "km"} <span class="text-gray-500">(as the crow flies)</span></p>` : ""}
            ${place.details.operator ? `<p><span class="text-gray-400">Operator:</span> ${place.details.operator}</p>` : ""}
            ${place.details.emergency ? `<p class="text-red-400">⚠️ Emergency services available</p>` : ""}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: "custom-popup",
      });

      // Add click handler for place selection (no routing here)
      marker.on("click", () => {
        onPlaceClick?.(place);
      });

      markersRef.current!.addLayer(marker);
    });
  }, [places]);

  // Handle geolocation
  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      alert(
        "Geolocation is not supported by this browser. Please click on the map to search a location.",
      );
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading("Getting your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.dismiss(loadingToast);
        const { latitude, longitude } = position.coords;
        onLocationFound?.(latitude, longitude);
      },
      (error) => {
        toast.dismiss(loadingToast);
        console.error("Geolocation error:", error);
        let errorMessage = "Unable to get your location. ";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Location access denied. Please enable location permission or click on the map to search.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage =
              "Location unavailable. Please try again or click on the map to search.";
            break;
          case error.TIMEOUT:
            errorMessage =
              "Location request timed out. Please try again or click on the map.";
            break;
          default:
            errorMessage = "Location error. Please click on the map to search.";
            break;
        }

        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000,
      },
    );
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* My Location Button */}
      <button
        onClick={handleMyLocation}
        className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors z-[1000]"
        title="Get my location"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Custom popup styles */}
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
          background: transparent;
          border-radius: 0;
          padding: 0;
          box-shadow: none;
        }
        .custom-popup .leaflet-popup-tip {
          background: #111827;
        }
        .custom-popup .leaflet-popup-close-button {
          color: #9ca3af;
          font-size: 18px;
          padding: 4px 8px;
        }
        .custom-popup .leaflet-popup-close-button:hover {
          color: white;
        }
      `}</style>
    </div>
  );
}
