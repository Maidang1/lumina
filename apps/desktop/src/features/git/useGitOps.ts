import { useCallback, useState } from "react";
import {
  deleteFile,
  discardFile,
  stageAll,
  stageFile,
  unstageAll,
  unstageFile,
} from "@/lib/tauri/github";
import { pushToast } from "@/lib/toast";

interface UseGitOpsOptions {
  refresh: () => Promise<void>;
  setError: (value: string | null) => void;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function useGitOps({ refresh, setError }: UseGitOpsOptions) {
  const [operatingKey, setOperatingKey] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const withFileOp = useCallback(
    async (key: string, operation: () => Promise<void>, fallback: string): Promise<void> => {
      setOperatingKey(key);
      try {
        await operation();
        await refresh();
        setError(null);
      } catch (err) {
        const message = errorMessage(err, fallback);
        setError(message);
        pushToast(message, "error");
      } finally {
        setOperatingKey(null);
      }
    },
    [refresh, setError],
  );

  const withBulkOp = useCallback(
    async (operation: () => Promise<void>, fallback: string): Promise<void> => {
      setBulkLoading(true);
      try {
        await operation();
        await refresh();
        setError(null);
      } catch (err) {
        const message = errorMessage(err, fallback);
        setError(message);
        pushToast(message, "error");
      } finally {
        setBulkLoading(false);
      }
    },
    [refresh, setError],
  );

  const stage = useCallback(
    async (path: string, key: string): Promise<void> =>
      withFileOp(key, () => stageFile(path), "暂存失败"),
    [withFileOp],
  );

  const unstage = useCallback(
    async (path: string, key: string): Promise<void> =>
      withFileOp(key, () => unstageFile(path), "取消暂存失败"),
    [withFileOp],
  );

  const discard = useCallback(
    async (path: string, key: string): Promise<void> =>
      withFileOp(key, () => discardFile(path), "放弃更改失败"),
    [withFileOp],
  );

  const remove = useCallback(
    async (path: string, key: string): Promise<void> =>
      withFileOp(key, () => deleteFile(path), "删除文件失败"),
    [withFileOp],
  );

  const stageEverything = useCallback(
    async (): Promise<void> => withBulkOp(() => stageAll(), "全部暂存失败"),
    [withBulkOp],
  );

  const unstageEverything = useCallback(
    async (): Promise<void> => withBulkOp(() => unstageAll(), "全部取消暂存失败"),
    [withBulkOp],
  );

  return {
    operatingKey,
    bulkLoading,
    stage,
    unstage,
    discard,
    remove,
    stageEverything,
    unstageEverything,
  };
}
