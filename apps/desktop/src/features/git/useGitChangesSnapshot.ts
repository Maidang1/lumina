import { useCallback, useState } from "react";
import { getChangesPreview, type GitChangesSnapshot } from "@/lib/tauri/github";

export function useGitChangesSnapshot() {
  const [snapshot, setSnapshot] = useState<GitChangesSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await getChangesPreview();
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取变更失败");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    snapshot,
    setSnapshot,
    loading,
    error,
    setError,
    refresh,
  };
}
