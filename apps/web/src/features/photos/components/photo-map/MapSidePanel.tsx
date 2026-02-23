import React from "react";
import { Button } from "@/shared/ui/button";

interface MapSidePanelProps {
  activeMonth: string;
  monthBuckets: [string, number][];
  onMonthChange: (month: string) => void;
  visiblePointsCount: number;
}

const MapSidePanel: React.FC<MapSidePanelProps> = ({
  activeMonth,
  monthBuckets,
  onMonthChange,
  visiblePointsCount,
}) => {
  return (
    <aside>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-400">Timeline</p>
        <span className="text-[10px] text-gray-500">
          {visiblePointsCount} points
        </span>
      </div>

      <div className="custom-scrollbar flex gap-1 overflow-x-auto">
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
    </aside>
  );
};

export default MapSidePanel;
