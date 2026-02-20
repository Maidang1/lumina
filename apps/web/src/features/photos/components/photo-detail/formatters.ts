export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function formatExifText(value?: string | number): string {
  if (!value) return "--";
  const normalized = typeof value === "string" ? value.trim() : value.toString();
  if (!normalized || normalized === "?" || normalized.toLowerCase() === "unknown") {
    return "--";
  }
  return normalized;
}

export function formatNumericWithUnit(value?: string, unit?: string): string {
  const base = formatExifText(value);
  if (base === "--") return "--";
  return unit ? `${base}${unit}` : base;
}
