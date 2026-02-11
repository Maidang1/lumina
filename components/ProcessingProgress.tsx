import React from "react";
import { ProcessingStage } from "../types";
import { Check, Loader2, AlertCircle, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ProcessingProgressProps {
  stages: ProcessingStage[];
}

const STAGE_LABELS: Record<string, string> = {
  thumbnail: "缩略图生成",
  exif: "EXIF 提取",
  ocr: "OCR 识别",
  color: "主色提取",
  blur: "模糊检测",
  phash: "感知哈希",
};

const ProcessingProgress: React.FC<ProcessingProgressProps> = ({ stages }) => {
  return (
    <div className="space-y-2">
      {stages.map((stage) => (
        <div key={stage.id} className="flex items-center gap-3">
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            {stage.status === "completed" && (
              <Check size={16} className="text-green-500" />
            )}
            {stage.status === "processing" && (
              <Loader2 size={16} className="text-blue-500 animate-spin" />
            )}
            {stage.status === "failed" && (
              <AlertCircle size={16} className="text-red-500" />
            )}
            {stage.status === "pending" && (
              <Circle size={16} className="text-gray-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-xs ${
                  stage.status === "completed"
                    ? "text-gray-400"
                    : stage.status === "processing"
                    ? "text-white"
                    : stage.status === "failed"
                    ? "text-red-400"
                    : "text-gray-500"
                }`}
              >
                {STAGE_LABELS[stage.id] || stage.name}
              </span>
              {stage.status === "processing" && stage.progress > 0 && (
                <span className="text-xs text-gray-500">
                  {Math.round(stage.progress)}%
                </span>
              )}
            </div>

            <Progress
              value={stage.progress}
              indicatorClassName={
                stage.status === "completed"
                  ? "bg-green-500"
                  : stage.status === "processing"
                  ? "bg-blue-500"
                  : stage.status === "failed"
                  ? "bg-red-500"
                  : "bg-gray-700"
              }
            />

            {stage.error && (
              <p className="text-xs text-red-400 mt-1 truncate">
                {stage.error}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProcessingProgress;
