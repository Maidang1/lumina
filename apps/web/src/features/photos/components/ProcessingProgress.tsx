import React from "react";
import { ProcessingStage } from "@/features/photos/types";
import { Check, Loader2, AlertCircle, Circle } from "lucide-react";
import { Progress } from "@/shared/ui/progress";

interface ProcessingProgressProps {
  stages: ProcessingStage[];
}

const STAGE_LABELS: Record<string, string> = {
  hash: "Hash",
  thumbnail: "Thumbnail",
  exif: "EXIF Extraction",
  region: "Region Resolve",
  privacy: "Privacy Sanitization",
  ocr: "OCR",
  color: "Dominant Color",
  blur: "Blur Detection",
  phash: "Perceptual Hash",
  finalize: "Metadata Assembly",
};

const ProcessingProgress: React.FC<ProcessingProgressProps> = ({ stages }) => {
  return (
    <div className="space-y-2.5 rounded-xl border border-white/10 bg-black/20 p-3">
      {stages.map((stage) => (
        <div key={stage.id} className="flex items-center gap-3">
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
            {stage.status === "completed" && (
              <Check size={14} className="text-emerald-300" />
            )}
            {stage.status === "processing" && (
              <Loader2 size={14} className="animate-spin text-[#c9a962] motion-reduce:animate-none" />
            )}
            {stage.status === "failed" && (
              <AlertCircle size={14} className="text-red-300" />
            )}
            {stage.status === "pending" && (
              <Circle size={14} className="text-gray-600" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between">
              <span
                className={`text-xs ${
                  stage.status === "completed"
                    ? "text-gray-300"
                    : stage.status === "processing"
                    ? "text-[#e7d3a4]"
                    : stage.status === "failed"
                    ? "text-red-300"
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
              {stage.status !== "processing" && typeof stage.duration_ms === "number" && (
                <span className="text-xs text-gray-500">{stage.duration_ms}ms</span>
              )}
            </div>

            <Progress
              value={stage.progress}
              className="h-1.5 bg-white/10"
              indicatorClassName={
                stage.status === "completed"
                  ? "bg-emerald-400"
                  : stage.status === "processing"
                  ? "bg-[#c9a962]"
                  : stage.status === "failed"
                  ? "bg-red-400"
                  : "bg-white/20"
              }
            />

            {stage.error && (
              <p className="mt-1 truncate text-xs text-red-300">
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
