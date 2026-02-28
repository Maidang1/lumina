import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  text,
}) => {
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div
          className={`animate-spin rounded-full border-2 border-white/[0.06] border-t-[#c9a962]/60 ${sizeClasses[size]}`}
        />
      </div>
      {text && (
        <p className="text-xs font-light tracking-wide text-zinc-400">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
