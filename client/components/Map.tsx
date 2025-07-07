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
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);

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

    // Add dark theme tile layer
    try {
      L.tileLayer(
        "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          attribution:
            '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
        },
      ).addTo(mapInstanceRef.current);

      console.log("Tile layer added successfully");
    } catch (error) {
      console.error("Error adding tile layer:", error);
    }

    // Add zoom control to top right
    L.control.zoom({ position: "topright" }).addTo(mapInstanceRef.current);

    // Initialize marker layers
    markersRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    // Map click handler
    mapInstanceRef.current.on("click", (e) => {
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

  // Update search radius circle
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing circle
    if (circleRef.current) {
      circleRef.current.remove();
    }

    // Remove existing center marker
    if (centerMarkerRef.current) {
      centerMarkerRef.current.remove();
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
      const marker = L.marker([place.lat, place.lon], {
        icon: icons[place.category],
      });

      // Create popup content
      const popupContent = `
        <div class="p-3 min-w-64 bg-gray-900 text-white rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">${PLACE_CATEGORIES[place.category].icon}</span>
            <h3 class="font-semibold text-sm">${place.name}</h3>
          </div>
          <div class="space-y-1 text-xs text-gray-300">
            <p><span class="text-gray-400">Category:</span> ${PLACE_CATEGORIES[place.category].label}</p>
            ${place.distance ? `<p><span class="text-gray-400">Distance:</span> ${place.distance}m</p>` : ""}
            ${place.details.operator ? `<p><span class="text-gray-400">Operator:</span> ${place.details.operator}</p>` : ""}
            ${place.details.emergency ? `<p class="text-red-400">⚠️ Emergency services available</p>` : ""}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: "custom-popup",
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
