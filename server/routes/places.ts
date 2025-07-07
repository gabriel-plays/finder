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
  const lowerName = name.toLowerCase().trim();

  // Filter out test entries and invalid names
  const invalidPatterns = [
    "test",
    "example",
    "xxx",
    "temp",
    "123",
    "unnamed",
    "no name",
    "construction",
    "under construction",
    "closed",
    "demolished",
  ];

  // Filter out generic/unhelpful names
  const genericPatterns = ["building", "structure", "facility", "site"];

  // Must have reasonable length
  if (name.length < 2 || name.length > 100) return false;

  // Check for invalid patterns
  if (invalidPatterns.some((pattern) => lowerName.includes(pattern)))
    return false;

  // Filter out purely generic names
  if (genericPatterns.some((pattern) => lowerName === pattern)) return false;

  // Filter out names that are just numbers or symbols
  if (/^[\d\W]+$/.test(name)) return false;

  return true;
}

// Helper function to check if two places are duplicates
function isDuplicate(place1: Place, place2: Place, threshold = 50): boolean {
  // Same exact name and very close location
  if (place1.name.toLowerCase() === place2.name.toLowerCase()) {
    const distance = calculateDistance(
      place1.lat,
      place1.lon,
      place2.lat,
      place2.lon,
    );
    return distance < threshold;
  }

  // Very similar names (basic similarity check)
  const name1 = place1.name.toLowerCase().replace(/[^\w\s]/g, "");
  const name2 = place2.name.toLowerCase().replace(/[^\w\s]/g, "");

  if (name1.includes(name2) || name2.includes(name1)) {
    const distance = calculateDistance(
      place1.lat,
      place1.lon,
      place2.lat,
      place2.lon,
    );
    return distance < threshold;
  }

  return false;
}

// Helper function to score place quality
function scorePlaceQuality(place: Place): number {
  let score = 0;

  // Prefer places with names over unnamed ones
  if (place.name && place.name !== "Unknown") score += 20;

  // Prefer places with operators (usually more official)
  if (place.details.operator) score += 15;

  // Emergency services are highly important
  if (place.details.emergency) score += 25;

  // Prefer specific amenity types over generic ones
  if (place.details.amenity) {
    const specificAmenities = [
      "hospital",
      "clinic",
      "pharmacy",
      "school",
      "university",
    ];
    if (specificAmenities.includes(place.details.amenity)) score += 10;
  }

  // Healthcare facilities get priority
  if (place.category === "healthcare") score += 5;

  // Penalize very generic names
  const genericNames = ["pharmacy", "hospital", "school", "bus stop"];
  if (genericNames.includes(place.name.toLowerCase())) score -= 5;

  return score;
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
    const rawPlaces: Place[] = [];

    // First pass: collect all valid places
    for (const element of data.elements) {
      const category = categorizePlace(element.tags || {});
      if (!category) continue;

      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;
      if (!lat || !lon) continue;

      const name =
        element.tags?.name ||
        element.tags?.operator ||
        element.tags?.brand ||
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

      rawPlaces.push(place);
    }

    // Second pass: remove duplicates
    const uniquePlaces: Place[] = [];
    for (const place of rawPlaces) {
      const isDupe = uniquePlaces.some((existing) =>
        isDuplicate(place, existing),
      );
      if (!isDupe) {
        uniquePlaces.push(place);
      }
    }

    // Third pass: score and sort by quality, then distance
    const scoredPlaces = uniquePlaces.map((place) => ({
      ...place,
      qualityScore: scorePlaceQuality(place),
    }));

    // Sort by quality score first, then distance
    scoredPlaces.sort((a, b) => {
      if (b.qualityScore !== a.qualityScore) {
        return b.qualityScore - a.qualityScore;
      }
      return (a.distance || 0) - (b.distance || 0);
    });

    // Fourth pass: apply category limits to top-quality results
    const places: Place[] = [];
    const categoryLimits = { healthcare: 12, transport: 10, education: 8 };
    const categoryCounts = { healthcare: 0, transport: 0, education: 0 };

    for (const place of scoredPlaces) {
      if (categoryCounts[place.category] < categoryLimits[place.category]) {
        places.push(place);
        categoryCounts[place.category]++;
      }
    }

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
