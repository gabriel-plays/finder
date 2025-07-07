import { PLACE_CATEGORIES } from "@shared/places";

interface LegendProps {
  placeCounts: Record<string, number>;
}

export default function Legend({ placeCounts }: LegendProps) {
  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 lg:p-4 shadow-xl min-w-48">
      <h3 className="text-white font-semibold text-sm mb-2 lg:mb-3 flex items-center gap-2">
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
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        <span className="hidden lg:inline">Map </span>Legend
      </h3>

      <div className="space-y-2 lg:space-y-3">
        {Object.entries(PLACE_CATEGORIES).map(([key, category]) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-3">
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs"
                style={{ backgroundColor: category.color }}
              >
                {category.icon}
              </div>
              <span className="text-gray-300 text-sm">{category.label}</span>
            </div>
            <span className="text-gray-400 text-xs bg-gray-800 px-2 py-1 rounded">
              {placeCounts[key] || 0}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 lg:mt-4 pt-2 lg:pt-3 border-t border-gray-700 hidden lg:block">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-3 h-3 bg-red-500 rounded-full border border-white animate-pulse"></div>
          <span>Search Center</span>
        </div>
      </div>
    </div>
  );
}
