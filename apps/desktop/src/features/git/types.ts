import type { GitChangesSnapshot, GitFileState } from "@/lib/tauri/github";

export type GitChangeSource = "staged" | "unstaged";

export interface GitChangeRow {
  key: string;
  source: GitChangeSource;
  path: string;
  oldPath?: string;
  status: string;
  untracked: boolean;
}

export interface GitChangeCounts {
  total: number;
  staged: number;
  unstaged: number;
  added: number;
  modified: number;
  deleted: number;
  renamed: number;
  copied: number;
  unmerged: number;
  untracked: number;
}

export interface DerivedGitChanges {
  stagedRows: GitChangeRow[];
  unstagedRows: GitChangeRow[];
  counts: GitChangeCounts;
}

function updateCounts(counts: GitChangeCounts, status: string, untracked: boolean): void {
  if (untracked) {
    counts.untracked += 1;
    counts.added += 1;
    return;
  }

  switch (status) {
    case "added":
      counts.added += 1;
      break;
    case "modified":
    case "type_changed":
      counts.modified += 1;
      break;
    case "deleted":
      counts.deleted += 1;
      break;
    case "renamed":
      counts.renamed += 1;
      break;
    case "copied":
      counts.copied += 1;
      break;
    case "unmerged":
      counts.unmerged += 1;
      break;
    default:
      break;
  }
}

function createRow(file: GitFileState, source: GitChangeSource, status: string, untracked = false): GitChangeRow {
  return {
    key: `${source}:${file.path}`,
    source,
    path: file.path,
    oldPath: file.old_path,
    status,
    untracked,
  };
}

export function deriveGitChanges(snapshot: GitChangesSnapshot | null): DerivedGitChanges {
  const stagedRows: GitChangeRow[] = [];
  const unstagedRows: GitChangeRow[] = [];
  const counts: GitChangeCounts = {
    total: 0,
    staged: 0,
    unstaged: 0,
    added: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
    copied: 0,
    unmerged: 0,
    untracked: 0,
  };

  if (!snapshot) {
    return { stagedRows, unstagedRows, counts };
  }

  for (const file of snapshot.files) {
    if (file.staged_status) {
      const row = createRow(file, "staged", file.staged_status, false);
      stagedRows.push(row);
      counts.staged += 1;
      counts.total += 1;
      updateCounts(counts, row.status, false);
    }

    if (file.unstaged_status) {
      const row = createRow(file, "unstaged", file.unstaged_status, false);
      unstagedRows.push(row);
      counts.unstaged += 1;
      counts.total += 1;
      updateCounts(counts, row.status, false);
    } else if (file.untracked) {
      const row = createRow(file, "unstaged", "untracked", true);
      unstagedRows.push(row);
      counts.unstaged += 1;
      counts.total += 1;
      updateCounts(counts, row.status, true);
    }
  }

  return { stagedRows, unstagedRows, counts };
}
