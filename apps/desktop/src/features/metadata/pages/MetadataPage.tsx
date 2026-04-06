import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileImage,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { selectFiles } from "@/lib/tauri/dialog";
import { tauriStorage } from "@/lib/tauri/storage";
import { pushToast } from "@/lib/toast";
import {
  parseImageMetadataFromPath,
  type ParseImageMetadataResult,
} from "@/lib/tauri/image";

type InspectorStatus = "queued" | "parsing" | "success" | "failed";

interface MetadataInspectorItem {
  id: string;
  path: string;
  name: string;
  status: InspectorStatus;
  durationMs?: number;
  error?: string;
  parsed?: ParseImageMetadataResult;
}

const STORAGE_CONCURRENCY_KEY = "lumina.concurrency";
const DEFAULT_CONCURRENCY = 3;

const clampConcurrency = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_CONCURRENCY;
  return Math.max(1, Math.min(10, Math.floor(value)));
};

const getMimeFromFilename = (filename: string): string | undefined => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  if (lower.endsWith(".avif")) return "image/avif";
  return undefined;
};

const getStatusBadgeClass = (status: InspectorStatus): string => {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  }
  if (status === "failed") {
    return "border-red-500/30 bg-red-500/15 text-red-300";
  }
  if (status === "parsing") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  }
  return "border-white/15 bg-white/5 text-[var(--muted-foreground)]";
};

const getStatusLabel = (status: InspectorStatus): string => {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  if (status === "parsing") return "解析中";
  return "待解析";
};

const toErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error.trim() || "解析失败";
  if (error instanceof Error) return error.message.trim() || "解析失败";
  if (!error) return "解析失败";
  try {
    return JSON.stringify(error);
  } catch {
    return "解析失败";
  }
};

const formatDuration = (durationMs?: number): string => {
  if (!durationMs || durationMs <= 0) return "-";
  return `${durationMs} ms`;
};

const MetadataPage: React.FC = () => {
  const [items, setItems] = useState<MetadataInspectorItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const loadConcurrency = async (): Promise<void> => {
      const raw = await tauriStorage.getItem(STORAGE_CONCURRENCY_KEY);
      const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_CONCURRENCY;
      setConcurrency(clampConcurrency(parsed));
    };
    void loadConcurrency();
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null);
      }
      return;
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const runParse = useCallback(
    async (targetIds: string[]) => {
      if (targetIds.length === 0) return;

      setIsParsing(true);
      setItems((prev) =>
        prev.map((item) =>
          targetIds.includes(item.id)
            ? {
                ...item,
                status: "parsing",
                parsed: undefined,
                durationMs: undefined,
                error: undefined,
              }
            : item,
        ),
      );

      let cursor = 0;
      const workerCount = Math.min(concurrency, targetIds.length);

      const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
          const index = cursor;
          cursor += 1;
          if (index >= targetIds.length) return;

          const itemId = targetIds[index];
          const current = itemsRef.current.find((entry) => entry.id === itemId);
          if (!current) continue;

          const startedAt = Date.now();
          try {
            const parsed = await parseImageMetadataFromPath({
              path: current.path,
              declaredMime: getMimeFromFilename(current.name),
            });
            const durationMs = Date.now() - startedAt;
            setItems((prev) =>
              prev.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      status: "success",
                      durationMs,
                      error: undefined,
                      parsed,
                    }
                  : item,
              ),
            );
          } catch (error) {
            const durationMs = Date.now() - startedAt;
            setItems((prev) =>
              prev.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      status: "failed",
                      parsed: undefined,
                      durationMs,
                      error: toErrorMessage(error),
                    }
                  : item,
              ),
            );
          }
        }
      });

      await Promise.all(workers);
      setIsParsing(false);
    },
    [concurrency],
  );

  const handleSelectFiles = useCallback(async () => {
    const selections = await selectFiles();
    if (!selections || selections.length === 0) return;

    const deduped = Array.from(
      new Map(
        selections.map((selection) => [
          selection.path,
          {
            id: selection.path,
            path: selection.path,
            name: selection.name,
            status: "queued" as const,
          },
        ]),
      ).values(),
    );

    const newIds: string[] = [];
    setItems((prev) => {
      const existing = new Set(prev.map((item) => item.id));
      const additions = deduped.filter((entry) => !existing.has(entry.id));
      additions.forEach((entry) => newIds.push(entry.id));
      return [...additions, ...prev];
    });

    if (newIds.length === 0) {
      pushToast("所选图片已在列表中", "error");
      return;
    }

    setSelectedId((prev) => prev ?? newIds[0]);
    pushToast(`已添加 ${newIds.length} 张图片`, "success");
    await runParse(newIds);
  }, [runParse]);

  const handleReparseAll = useCallback(async () => {
    const targetIds = itemsRef.current.map((item) => item.id);
    if (targetIds.length === 0) return;
    await runParse(targetIds);
  }, [runParse]);

  const handleClear = useCallback(() => {
    if (isParsing) return;
    setItems([]);
    setSelectedId(null);
  }, [isParsing]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const stats = useMemo(() => {
    const success = items.filter((item) => item.status === "success").length;
    const failed = items.filter((item) => item.status === "failed").length;
    const parsing = items.filter((item) => item.status === "parsing").length;
    return { total: items.length, success, failed, parsing };
  }, [items]);

  const selectedMetadataJson = selectedItem?.parsed?.metadata
    ? JSON.stringify(selectedItem.parsed.metadata, null, 2)
    : "";

  const handleCopyJson = useCallback(async () => {
    if (!selectedMetadataJson) return;
    try {
      await navigator.clipboard.writeText(selectedMetadataJson);
      pushToast("Metadata JSON 已复制", "success");
    } catch {
      pushToast("复制失败，请检查系统剪贴板权限", "error");
    }
  }, [selectedMetadataJson]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 text-[var(--lumina-text)]">
      <header className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-sm">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Metadata Inspector
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          本地解析图片 metadata（EXIF / GPS / region / processing metrics）
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Button onClick={() => void handleSelectFiles()} disabled={isParsing}>
          <FileImage className="mr-2" size={16} />
          选择图片
        </Button>
        <Button
          variant="outline"
          onClick={() => void handleReparseAll()}
          disabled={isParsing || items.length === 0}
        >
          {isParsing ? (
            <Loader2 className="mr-2 animate-spin" size={16} />
          ) : (
            <RefreshCw className="mr-2" size={16} />
          )}
          重新解析全部
        </Button>
        <Button
          variant="ghost"
          onClick={handleClear}
          disabled={isParsing || items.length === 0}
        >
          <Trash2 className="mr-2" size={16} />
          清空列表
        </Button>
        <div className="ml-auto flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <span>总数 {stats.total}</span>
          <span className="text-emerald-300">成功 {stats.success}</span>
          <span className="text-red-300">失败 {stats.failed}</span>
          <span className="text-amber-300">进行中 {stats.parsing}</span>
          <span>并发 {concurrency}</span>
        </div>
      </section>

      <section className="grid min-h-[64vh] grid-cols-12 gap-4">
        <aside className="col-span-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-4 py-3 text-sm font-medium">
            已选文件
          </div>
          <div className="max-h-[62vh] overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-[var(--muted-foreground)]">
                还没有文件，点击“选择图片”开始解析
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`mb-2 w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                    item.id === selectedId
                      ? "border-[var(--ring)] bg-white/[0.09]"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="line-clamp-1 text-sm font-medium text-[var(--foreground)]"
                      title={item.name}
                    >
                      {item.name}
                    </p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${getStatusBadgeClass(item.status)}`}
                    >
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <p
                    className="mt-1 line-clamp-1 text-xs text-[var(--muted-foreground)]"
                    title={item.path}
                  >
                    {item.path}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>耗时 {formatDuration(item.durationMs)}</span>
                    {item.status === "success" && (
                      <CheckCircle2 size={12} className="text-emerald-300" />
                    )}
                    {item.status === "failed" && (
                      <AlertTriangle size={12} className="text-red-300" />
                    )}
                  </div>
                  {item.error && (
                    <p className="mt-2 line-clamp-2 text-xs text-red-300" title={item.error}>
                      {item.error}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        <article className="col-span-8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          {!selectedItem ? (
            <div className="flex h-full min-h-[62vh] items-center justify-center text-sm text-[var(--muted-foreground)]">
              选择左侧文件查看 metadata 详情
            </div>
          ) : (
            <div className="max-h-[62vh] space-y-4 overflow-y-auto p-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <h3 className="text-sm font-medium text-[var(--foreground)]">文件信息</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)]">
                  <div>文件名: {selectedItem.name}</div>
                  <div>状态: {getStatusLabel(selectedItem.status)}</div>
                  <div className="col-span-2">路径: {selectedItem.path}</div>
                  <div>耗时: {formatDuration(selectedItem.durationMs)}</div>
                  <div>
                    检测格式: {selectedItem.parsed?.formatReport.detectedMime || "-"}
                  </div>
                </div>
              </div>

              {selectedItem.parsed && (
                <>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <h3 className="text-sm font-medium text-[var(--foreground)]">解析摘要</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)]">
                      <div>
                        图像 ID: {selectedItem.parsed.metadata?.image_id || "-"}
                      </div>
                      <div>
                        尺寸:{" "}
                        {selectedItem.parsed.metadata?.derived?.dimensions
                          ? `${selectedItem.parsed.metadata.derived.dimensions.width} x ${selectedItem.parsed.metadata.derived.dimensions.height}`
                          : "-"}
                      </div>
                      <div>
                        GPS 原始存在:{" "}
                        {selectedItem.parsed.metadata?.privacy?.original_contains_gps
                          ? "是"
                          : "否"}
                      </div>
                      <div>
                        省份:{" "}
                        {selectedItem.parsed.metadata?.geo?.region?.province || "-"}
                      </div>
                      <div>
                        城市: {selectedItem.parsed.metadata?.geo?.region?.city || "-"}
                      </div>
                      <div>
                        逆地理来源:{" "}
                        {selectedItem.parsed.metadata?.geo?.region?.source || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <h3 className="text-sm font-medium text-[var(--foreground)]">阶段耗时</h3>
                    <div className="mt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                      {selectedItem.parsed.stageMetrics.length === 0 ? (
                        <p>-</p>
                      ) : (
                        selectedItem.parsed.stageMetrics.map((stage) => (
                          <div
                            key={`${selectedItem.id}-${stage.task_id}`}
                            className="flex items-center justify-between rounded border border-white/10 px-2 py-1"
                          >
                            <span>{stage.task_id}</span>
                            <span>
                              {stage.status} · {stage.duration_ms} ms
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-[var(--foreground)]">
                        原始 Metadata JSON
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCopyJson()}
                        disabled={!selectedMetadataJson}
                      >
                        <Copy size={14} className="mr-1" />
                        复制 JSON
                      </Button>
                    </div>
                    <pre className="max-h-[340px] overflow-auto rounded border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-zinc-200">
                      {selectedMetadataJson || "{}"}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </article>
      </section>
    </div>
  );
};

export default MetadataPage;
