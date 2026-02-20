import React from "react";
import { Loader2 } from "lucide-react";
import { RegionAggregate } from "@/features/photos/types/map";

interface MapSidePanelProps {
  activeMonth: string;
  monthBuckets: [string, number][];
  onMonthChange: (month: string) => void;
  regionAggregates: RegionAggregate[];
  selectedRegionKey: string | null;
  onRegionClick: (aggregate: RegionAggregate) => void;
  isResolvingRegions: boolean;
  isLoadingBoundaries: boolean;
}

const MapSidePanel: React.FC<MapSidePanelProps> = ({
  activeMonth,
  monthBuckets,
  onMonthChange,
  regionAggregates,
  selectedRegionKey,
  onRegionClick,
  isResolvingRegions,
  isLoadingBoundaries,
}) => {
  return (
    <aside>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-400">Timeline</p>
        <span className="text-[10px] text-gray-500">
          {regionAggregates.reduce((sum, item) => sum + item.count, 0)} points
        </span>
      </div>

      <div className="custom-scrollbar flex gap-1 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => onMonthChange("all")}
          className={`shrink-0 rounded-lg px-2 py-1 text-xs transition ${
            activeMonth === "all"
              ? "bg-white/10 text-white"
              : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
          }`}
        >
          All
        </button>
        {monthBuckets.map(([month, count]) => (
          <button
            key={month}
            type="button"
            onClick={() => onMonthChange(month)}
            className={`shrink-0 rounded-lg px-2 py-1 text-xs transition ${
              activeMonth === month
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
            }`}
          >
            {month} <span className="opacity-50">{count}</span>
          </button>
        ))}
      </div>

      <div className="mt-2 border-t border-white/5 pt-2">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-gray-400">Regions</p>
          {(isResolvingRegions || isLoadingBoundaries) && (
            <Loader2 size={12} className="animate-spin text-gray-500" />
          )}
        </div>
        <div className="custom-scrollbar max-h-[240px] space-y-0.5 overflow-y-auto pr-1">
          {regionAggregates.slice(0, 40).map((aggregate) => {
            const isSelected = selectedRegionKey === aggregate.key;
            return (
              <button
                key={aggregate.key}
                type="button"
                onClick={() => onRegionClick(aggregate)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition ${
                  isSelected
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1">{aggregate.region.displayName}</span>
                  <span className="font-mono text-[10px] text-gray-500">{aggregate.count}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

export default MapSidePanel;
