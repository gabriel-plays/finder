export interface Place {
  id: string;
  name: string;
  category: "healthcare" | "transport" | "education";
  lat: number;
  lon: number;
  distance?: number;
  details: {
    operator?: string;
    emergency?: boolean;
    amenity?: string;
    highway?: string;
    public_transport?: string;
    healthcare?: string;
  };
}

export interface SearchParams {
  lat: number;
  lon: number;
  radius: number; // in meters
}

export interface PlacesResponse {
  places: Place[];
  searchCenter: {
    lat: number;
    lon: number;
  };
  radius: number;
}

export const PLACE_CATEGORIES = {
  healthcare: {
    label: "Healthcare",
    icon: "🏥",
    color: "#10b981", // emerald-500
    queries: [
      "amenity=hospital",
      "amenity=clinic",
      "amenity=doctors",
      "amenity=pharmacy",
      "healthcare=*",
    ],
  },
  transport: {
    label: "Transport",
    icon: "🚌",
    color: "#f59e0b", // amber-500
    queries: [
      "amenity=bus_station",
      "highway=bus_stop",
      "public_transport=stop_position",
      "public_transport=platform",
      "railway=station",
    ],
  },
  education: {
    label: "Education",
    icon: "🏫",
    color: "#3b82f6", // blue-500
    queries: [
      "amenity=school",
      "amenity=university",
      "amenity=college",
      "amenity=kindergarten",
    ],
  },
} as const;
