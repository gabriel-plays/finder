import { Place, PLACE_CATEGORIES } from "@shared/places";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

// Helper function to get detailed place type description
function getPlaceTypeInfo(place: Place): {
  type: string;
  icon: string;
  description: string;
} {
  const { details, category } = place;

  if (category === "transport") {
    if (details.highway === "bus_stop") {
      return {
        type: "Bus Stop",
        icon: "🚏",
        description: "Public bus stop",
      };
    }
    if (details.amenity === "bus_station") {
      return {
        type: "Bus Station",
        icon: "🚌",
        description: "Major bus terminal",
      };
    }
    if (details.public_transport === "platform") {
      return {
        type: "Platform",
        icon: "🚉",
        description: "Transport platform",
      };
    }
    if (details.public_transport === "stop_position") {
      return {
        type: "Stop Position",
        icon: "📍",
        description: "Exact stopping point",
      };
    }
    if (
      details.amenity === "railway" ||
      place.name.toLowerCase().includes("station")
    ) {
      return {
        type: "Railway Station",
        icon: "🚂",
        description: "Train/Underground station",
      };
    }
    return {
      type: "Transport Hub",
      icon: "🚇",
      description: "Public transport facility",
    };
  }

  if (category === "healthcare") {
    if (details.amenity === "hospital") {
      return {
        type: "Hospital",
        icon: "🏥",
        description: details.emergency
          ? "Emergency hospital"
          : "General hospital",
      };
    }
    if (details.amenity === "clinic") {
      return {
        type: "Clinic",
        icon: "🩺",
        description: "Medical clinic",
      };
    }
    if (details.amenity === "pharmacy") {
      return {
        type: "Pharmacy",
        icon: "💊",
        description: "Pharmacy/Chemist",
      };
    }
    if (details.amenity === "doctors") {
      return {
        type: "Doctor's Office",
        icon: "👩‍⚕️",
        description: "Medical practice",
      };
    }
    return {
      type: "Healthcare",
      icon: "⚕️",
      description: "Healthcare facility",
    };
  }

  if (category === "education") {
    if (details.amenity === "university") {
      return {
        type: "University",
        icon: "🎓",
        description: "Higher education",
      };
    }
    if (details.amenity === "college") {
      return {
        type: "College",
        icon: "🏛️",
        description: "Educational institution",
      };
    }
    if (details.amenity === "school") {
      return {
        type: "School",
        icon: "🏫",
        description: "Primary/Secondary school",
      };
    }
    if (details.amenity === "kindergarten") {
      return {
        type: "Kindergarten",
        icon: "🧒",
        description: "Early childhood education",
      };
    }
    return {
      type: "Educational",
      icon: "📚",
      description: "Educational facility",
    };
  }

  return {
    type: "Facility",
    icon: "📍",
    description: "Public facility",
  };
}

interface ResultsListProps {
  places: Place[];
  onPlaceClick: (place: Place) => void;
  selectedPlaceId?: string;
  isLoading: boolean;
}

export default function ResultsList({
  places,
  onPlaceClick,
  selectedPlaceId,
  isLoading,
}: ResultsListProps) {
  if (isLoading) {
    return (
      <div className="w-80 bg-gray-900/50 backdrop-blur-sm border-l border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="text-lg font-semibold text-white">
            Loading results...
          </h2>
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-800/50 rounded-lg p-3">
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className="w-80 bg-gray-900/50 backdrop-blur-sm border-l border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">
          Search Results
        </h2>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">
            No services found in this area. Try expanding your search radius or
            searching a different location.
          </p>
        </div>
      </div>
    );
  }

  // Group places by category and then by facility type
  const groupedPlaces = places.reduce(
    (acc, place) => {
      const typeInfo = getPlaceTypeInfo(place);

      if (!acc[place.category]) {
        acc[place.category] = {};
      }
      if (!acc[place.category][typeInfo.type]) {
        acc[place.category][typeInfo.type] = [];
      }
      acc[place.category][typeInfo.type].push(place);
      return acc;
    },
    {} as Record<string, Record<string, Place[]>>,
  );

  // State for collapsed categories and subcategories
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(Object.keys(PLACE_CATEGORIES)),
  );
  const [collapsedSubCategories, setCollapsedSubCategories] = useState<
    Set<string>
  >(new Set());

  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  const toggleSubCategory = (key: string) => {
    const newCollapsed = new Set(collapsedSubCategories);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedSubCategories(newCollapsed);
  };

  return (
    <div className="w-96 bg-gray-900/50 backdrop-blur-sm border-l border-gray-800 flex flex-col h-full max-h-full overflow-hidden relative">
      <div className="p-4 border-b border-gray-800 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
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
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </svg>
          Search Results
        </h2>
        <p className="text-gray-400 text-sm">
          Found {places.length} services nearby
        </p>
      </div>

      <div className="absolute top-20 bottom-0 left-0 right-0 overflow-y-auto results-scroll-container">
        <div className="p-4 space-y-4">
          {Object.entries(groupedPlaces).map(([category, subCategories]) => {
            const config =
              PLACE_CATEGORIES[category as keyof typeof PLACE_CATEGORIES];
            const isCollapsed = collapsedCategories.has(category);
            const totalPlaces = Object.values(subCategories).flat().length;

            return (
              <div
                key={category}
                className="border border-gray-700 rounded-lg bg-gray-800/30"
              >
                <Collapsible
                  open={!isCollapsed}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 hover:bg-gray-800/50 transition-colors rounded-t-lg">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: config.color }}
                        ></div>
                        <h3 className="text-base font-bold text-white">
                          {config.label}
                        </h3>
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full">
                          {totalPlaces}
                        </span>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          isCollapsed ? "rotate-0" : "rotate-90"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="border-t border-gray-700">
                    <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
                      {Object.entries(subCategories).map(
                        ([facilityType, facilityPlaces]) => {
                          const subKey = `${category}-${facilityType}`;
                          const isSubCollapsed =
                            collapsedSubCategories.has(subKey);
                          const typeInfo = getPlaceTypeInfo(facilityPlaces[0]);

                          return (
                            <div
                              key={subKey}
                              className="border border-gray-600/50 rounded-md bg-gray-800/20"
                            >
                              <Collapsible
                                open={!isSubCollapsed}
                                onOpenChange={() => toggleSubCategory(subKey)}
                              >
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center justify-between p-2 hover:bg-gray-700/30 transition-colors rounded-t-md">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">
                                        {typeInfo.icon}
                                      </span>
                                      <h4 className="text-sm font-semibold text-gray-200">
                                        {facilityType}
                                      </h4>
                                      <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">
                                        {facilityPlaces.length}
                                      </span>
                                    </div>
                                    <svg
                                      className={`w-4 h-4 text-gray-500 transition-transform ${
                                        isSubCollapsed
                                          ? "rotate-0"
                                          : "rotate-90"
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                      />
                                    </svg>
                                  </div>
                                </CollapsibleTrigger>

                                <CollapsibleContent className="border-t border-gray-600/30">
                                  <div className="p-2 space-y-2">
                                    {facilityPlaces.map((place) => {
                                      const placeTypeInfo =
                                        getPlaceTypeInfo(place);

                                      return (
                                        <Card
                                          key={place.id}
                                          className={`cursor-pointer transition-all duration-200 border-gray-600 hover:border-gray-500 ${
                                            selectedPlaceId === place.id
                                              ? "bg-blue-900/30 border-blue-500"
                                              : "bg-gray-800/40 hover:bg-gray-700/50"
                                          }`}
                                          onClick={() => onPlaceClick(place)}
                                        >
                                          <CardContent className="p-3">
                                            <div className="flex items-start justify-between mb-2">
                                              <h5 className="text-white text-sm font-medium line-clamp-2 flex-1">
                                                {place.name}
                                              </h5>
                                            </div>

                                            <div className="space-y-1">
                                              {place.distance && (
                                                <div className="flex items-center gap-1">
                                                  <svg
                                                    className="w-3 h-3 text-gray-500"
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
                                                  </svg>
                                                  <span className="text-xs text-gray-400">
                                                    {place.distance < 1000
                                                      ? `${place.distance}m away`
                                                      : `${(place.distance / 1000).toFixed(1)}km away`}
                                                  </span>
                                                </div>
                                              )}

                                              {place.details.operator && (
                                                <div className="flex items-center gap-1">
                                                  <svg
                                                    className="w-3 h-3 text-gray-500"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      strokeWidth={2}
                                                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                                    />
                                                  </svg>
                                                  <span className="text-xs text-blue-300 truncate">
                                                    {place.details.operator}
                                                  </span>
                                                </div>
                                              )}

                                              {place.details.emergency && (
                                                <Badge
                                                  variant="destructive"
                                                  className="text-xs bg-red-900/50 text-red-300"
                                                >
                                                  ⚠️ Emergency
                                                </Badge>
                                              )}
                                            </div>
                                          </CardContent>
                                        </Card>
                                      );
                                    })}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
