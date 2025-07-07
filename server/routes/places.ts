import { RequestHandler } from "express";
import { PlacesResponse, Place, PLACE_CATEGORIES } from "../../shared/places";

// OpenStreetMap Overpass API endpoint
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Helper function to calculate distance between two points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to determine place category
function categorizePlace(
  tags: any,
): "healthcare" | "transport" | "education" | null {
  if (
    tags.amenity &&
    ["hospital", "clinic", "doctors", "pharmacy"].includes(tags.amenity)
  ) {
    return "healthcare";
  }
  if (tags.healthcare) {
    return "healthcare";
  }
  if (tags.amenity && ["bus_station"].includes(tags.amenity)) {
    return "transport";
  }
  if (tags.highway === "bus_stop" || tags.public_transport) {
    return "transport";
  }
  if (tags.railway === "station") {
    return "transport";
  }
  if (
    tags.amenity &&
    ["school", "university", "college", "kindergarten"].includes(tags.amenity)
  ) {
    return "education";
  }
  return null;
}

// Helper function to clean and validate place names
function cleanPlaceName(name: string): boolean {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  // Filter out test entries and invalid names
  const invalidPatterns = ["test", "example", "xxx", "temp", "123"];
  return (
    !invalidPatterns.some((pattern) => lowerName.includes(pattern)) &&
    name.length > 1
  );
}

export const handlePlacesSearch: RequestHandler = async (req, res) => {
  try {
    const { lat, lon, radius = 2000 } = req.query;

    if (!lat || !lon) {
      return res
        .status(400)
        .json({ error: "Latitude and longitude are required" });
    }

    const centerLat = parseFloat(lat as string);
    const centerLon = parseFloat(lon as string);
    const searchRadius = parseInt(radius as string);

    // Build Overpass query for all categories
    const overpassQuery = `
[out:json][timeout:25];
(
  node["amenity"~"^(hospital|clinic|doctors|pharmacy)$"](around:${searchRadius},${centerLat},${centerLon});
  node["healthcare"](around:${searchRadius},${centerLat},${centerLon});
  node["amenity"="bus_station"](around:${searchRadius},${centerLat},${centerLon});
  node["highway"="bus_stop"](around:${searchRadius},${centerLat},${centerLon});
  node["public_transport"~"^(stop_position|platform)$"](around:${searchRadius},${centerLat},${centerLon});
  node["railway"="station"](around:${searchRadius},${centerLat},${centerLon});
  node["amenity"~"^(school|university|college|kindergarten)$"](around:${searchRadius},${centerLat},${centerLon});
  way["amenity"~"^(hospital|clinic|doctors|pharmacy)$"](around:${searchRadius},${centerLat},${centerLon});
  way["healthcare"](around:${searchRadius},${centerLat},${centerLon});
  way["amenity"="bus_station"](around:${searchRadius},${centerLat},${centerLon});
  way["amenity"~"^(school|university|college|kindergarten)$"](around:${searchRadius},${centerLat},${centerLon});
);
out center;`;

    console.log(
      `Fetching places from OpenStreetMap for lat: ${centerLat}, lon: ${centerLon}, radius: ${searchRadius}m`,
    );
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenStreetMap API error ${response.status}:`, errorText);
      throw new Error(`OpenStreetMap API error: ${response.status}`);
    }

    const data = await response.json();
    const places: Place[] = [];
    const categoryLimits = { healthcare: 15, transport: 15, education: 15 };
    const categoryCounts = { healthcare: 0, transport: 0, education: 0 };

    for (const element of data.elements) {
      // Skip if we've reached the limit for any category
      const category = categorizePlace(element.tags || {});
      if (!category || categoryCounts[category] >= categoryLimits[category]) {
        continue;
      }

      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;

      if (!lat || !lon) continue;

      const name =
        element.tags?.name ||
        element.tags?.operator ||
        element.tags?.amenity ||
        "Unknown";

      // Clean and validate the name
      if (!cleanPlaceName(name)) continue;

      const distance = calculateDistance(centerLat, centerLon, lat, lon);

      // Skip if outside radius (with small buffer for rounding errors)
      if (distance > searchRadius + 100) continue;

      const place: Place = {
        id: `${element.type}_${element.id}`,
        name,
        category,
        lat,
        lon,
        distance: Math.round(distance),
        details: {
          operator: element.tags?.operator,
          emergency: element.tags?.emergency === "yes",
          amenity: element.tags?.amenity,
          highway: element.tags?.highway,
          public_transport: element.tags?.public_transport,
          healthcare: element.tags?.healthcare,
        },
      };

      places.push(place);
      categoryCounts[category]++;
    }

    // Sort by distance
    places.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    const result: PlacesResponse = {
      places,
      searchCenter: { lat: centerLat, lon: centerLon },
      radius: searchRadius,
    };

    console.log(
      `Found ${places.length} places (Healthcare: ${categoryCounts.healthcare}, Transport: ${categoryCounts.transport}, Education: ${categoryCounts.education})`,
    );

    res.json(result);
  } catch (error) {
    console.error("Error fetching places:", error);
    res.status(500).json({
      error: "Failed to fetch places",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
