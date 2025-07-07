import { Slider } from "@/components/ui/slider";

interface RadiusControlProps {
  radius: number;
  onRadiusChange: (radius: number) => void;
  isLoading?: boolean;
}

const RADIUS_OPTIONS = [
  { value: 500, label: "0.5km" },
  { value: 1000, label: "1km" },
  { value: 2000, label: "2km" },
  { value: 3000, label: "3km" },
  { value: 5000, label: "5km" },
  { value: 10000, label: "10km" },
];

export default function RadiusControl({
  radius,
  onRadiusChange,
  isLoading,
}: RadiusControlProps) {
  const currentOption =
    RADIUS_OPTIONS.find((option) => option.value === radius) ||
    RADIUS_OPTIONS[2];

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 lg:p-4 shadow-xl min-w-48">
      <div className="flex items-center gap-2 mb-2 lg:mb-3">
        <svg
          className="w-4 h-4 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v8m4-4H8"
          />
        </svg>
        <h3 className="text-white font-semibold text-sm">Search Radius</h3>
        {isLoading && (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        )}
      </div>

      <div className="space-y-3 lg:space-y-4">
        <div className="hidden lg:block px-2">
          <Slider
            value={[radius]}
            onValueChange={(values) => onRadiusChange(values[0])}
            min={500}
            max={10000}
            step={500}
            className="w-full"
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-3 lg:grid-cols-3 gap-1">
          {RADIUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onRadiusChange(option.value)}
              disabled={isLoading}
              className={`
                px-2 py-1 text-xs rounded transition-colors
                ${
                  radius === option.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }
                ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="text-center">
          <span className="text-base lg:text-lg font-semibold text-white">
            {currentOption.label}
          </span>
          <p className="text-xs text-gray-400 mt-1 hidden lg:block">
            Current radius
          </p>
        </div>
      </div>
    </div>
  );
}
