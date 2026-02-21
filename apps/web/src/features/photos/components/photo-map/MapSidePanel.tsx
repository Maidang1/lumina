import React from "react";
import {
  Download,
  Flame,
  Layers3,
  Loader2,
  Route,
  SunMoon,
} from "lucide-react";
import {
  MapLayerMode,
  MapThemeMode,
  RegionAggregate,
} from "@/features/photos/types/map";
import { Button } from "@/shared/ui/button";

interface MapSidePanelProps {
  activeMonth: string;
  monthBuckets: [string, number][];
  onMonthChange: (month: string) => void;
  regionAggregates: RegionAggregate[];
  selectedRegionKey: string | null;
  onRegionClick: (aggregate: RegionAggregate) => void;
  isResolvingRegions: boolean;
  isLoadingBoundaries: boolean;
  mapLayerMode: MapLayerMode;
  onMapLayerModeChange: (mode: MapLayerMode) => void;
  mapTheme: MapThemeMode;
  onMapThemeChange: (theme: MapThemeMode) => void;
  showRoute: boolean;
  onToggleRoute: () => void;
  canExportGpx: boolean;
  onExportGpx: () => void;
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
  mapLayerMode,
  onMapLayerModeChange,
  mapTheme,
  onMapThemeChange,
  showRoute,
  onToggleRoute,
  canExportGpx,
  onExportGpx,
}) => {
  const modeButtonClass = (active: boolean): string =>
    `h-auto shrink-0 rounded-lg px-2 py-1 text-xs transition ${
      active
        ? "bg-white/10 text-white"
        : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
    }`;

  return (
    <aside>
      <div className="mb-2 space-y-2">
        <div className="grid grid-cols-3 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMapLayerModeChange("boundary")}
            className={modeButtonClass(mapLayerMode === "boundary")}
          >
            <Layers3 size={12} />
            <span>Boundary</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMapLayerModeChange("cluster")}
            className={modeButtonClass(mapLayerMode === "cluster")}
          >
            <Layers3 size={12} />
            <span>Cluster</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMapLayerModeChange("heat")}
            className={modeButtonClass(mapLayerMode === "heat")}
          >
            <Flame size={12} />
            <span>Heat</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onMapThemeChange(mapTheme === "dark" ? "light" : "dark")
            }
            className={modeButtonClass(false)}
          >
            <SunMoon size={12} />
            <span>{mapTheme === "dark" ? "Dark" : "Light"}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleRoute}
            className={modeButtonClass(showRoute)}
          >
            <Route size={12} />
            <span>{showRoute ? "Route On" : "Route Off"}</span>
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canExportGpx}
          onClick={onExportGpx}
          className={`h-auto w-full rounded-lg px-2 py-1 text-xs transition ${
            canExportGpx
              ? "text-gray-300 hover:bg-white/5 hover:text-white"
              : "cursor-not-allowed text-gray-600"
          }`}
        >
          <Download size={12} />
          <span>Export GPX</span>
        </Button>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-400">Timeline</p>
        <span className="text-[10px] text-gray-500">
          {regionAggregates.reduce((sum, item) => sum + item.count, 0)} points
        </span>
      </div>

      <div className="custom-scrollbar flex gap-1 overflow-x-auto pb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onMonthChange("all")}
          className={`h-auto shrink-0 rounded-lg px-2 py-1 text-xs transition ${
            activeMonth === "all"
              ? "bg-white/10 text-white"
              : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
          }`}
        >
          All
        </Button>
        {monthBuckets.map(([month, count]) => (
          <Button
            key={month}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(month)}
            className={`h-auto shrink-0 rounded-lg px-2 py-1 text-xs transition ${
              activeMonth === month
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
            }`}
          >
            {month} <span className="opacity-50">{count}</span>
          </Button>
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
              <Button
                key={aggregate.key}
                type="button"
                variant="ghost"
                onClick={() => onRegionClick(aggregate)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition ${
                  isSelected
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1">
                    {aggregate.region.displayName}
                  </span>
                  <span className="font-mono text-[10px] text-gray-500">
                    {aggregate.count}
                  </span>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

export default MapSidePanel;
