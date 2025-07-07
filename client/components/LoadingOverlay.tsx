interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export default function LoadingOverlay({
  isVisible,
  message = "Searching for nearby services...",
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000]">
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-6 shadow-2xl max-w-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-8 h-8 border-3 border-blue-300/30 rounded-full"></div>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Searching...</h3>
            <p className="text-gray-400 text-xs mt-1">{message}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span>Querying OpenStreetMap...</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            <span>Processing location data...</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Calculating distances...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
