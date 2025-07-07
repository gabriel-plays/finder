import { Place, PLACE_CATEGORIES } from "@shared/places";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

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

  // Group places by category
  const groupedPlaces = places.reduce(
    (acc, place) => {
      if (!acc[place.category]) acc[place.category] = [];
      acc[place.category].push(place);
      return acc;
    },
    {} as Record<string, Place[]>,
  );

  // State for collapsed categories (all collapsed by default)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(Object.keys(PLACE_CATEGORIES)),
  );

  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  return (
    <div className="w-80 bg-gray-900/50 backdrop-blur-sm border-l border-gray-800 flex flex-col h-full">
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

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {Object.entries(groupedPlaces).map(([category, categoryPlaces]) => {
            const config =
              PLACE_CATEGORIES[category as keyof typeof PLACE_CATEGORIES];
            const isCollapsed = collapsedCategories.has(category);

            return (
              <Collapsible
                key={category}
                open={!isCollapsed}
                onOpenChange={() => toggleCategory(category)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: config.color }}
                      ></div>
                      <h3 className="text-sm font-semibold text-gray-300">
                        {config.label} ({categoryPlaces.length})
                      </h3>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
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

                <CollapsibleContent className="mt-2">
                  <div className="space-y-2 ml-5">
                    {categoryPlaces.map((place) => (
                      <Card
                        key={place.id}
                        className={`cursor-pointer transition-all duration-200 border-gray-700 hover:border-gray-600 ${
                          selectedPlaceId === place.id
                            ? "bg-blue-900/30 border-blue-600"
                            : "bg-gray-800/50 hover:bg-gray-800/80"
                        }`}
                        onClick={() => onPlaceClick(place)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="text-white text-sm font-medium line-clamp-2 flex-1">
                              {place.name}
                            </h4>
                            <span className="text-xs text-gray-400 ml-2">
                              {config.icon}
                            </span>
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
                                    ? `${place.distance}m`
                                    : `${(place.distance / 1000).toFixed(1)}km`}
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
                                <span className="text-xs text-gray-400 truncate">
                                  {place.details.operator}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-2 mt-2">
                              <Badge
                                variant="secondary"
                                className="text-xs bg-gray-700 text-gray-300"
                              >
                                {place.details.amenity || category}
                              </Badge>
                              {place.details.emergency && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs bg-red-900/50 text-red-300"
                                >
                                  ⚠️ Emergency
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </div>
  );
}
