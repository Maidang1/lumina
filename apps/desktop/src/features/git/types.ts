import type { GitChangesSnapshot, GitFileState } from "@/lib/tauri/github";

export type GitChangeSource = "staged" | "unstaged";

export interface ImageGroup {
  imageId: string;
  basePath: string;
  rows: GitChangeRow[];
}

export interface GroupedGitChanges {
  stagedGroups: ImageGroup[];
  unstagedGroups: ImageGroup[];
  stagedUngrouped: GitChangeRow[];
  unstagedUngrouped: GitChangeRow[];
}

interface GitChangeCounts {
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

interface DerivedGitChanges {
  stagedRows: GitChangeRow[];
  unstagedRows: GitChangeRow[];
  counts: GitChangeCounts;
}

export interface GitChangeRow {
  key: string;
  source: GitChangeSource;
  path: string;
  oldPath?: string;
  status: string;
  untracked: boolean;
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

const IMAGE_OBJECT_RE = /^objects\/([0-9a-f]{2})\/([0-9a-f]{2})\/sha256_([0-9a-f]+)\//i;

function extractImageId(filePath: string): string | null {
  const match = filePath.match(IMAGE_OBJECT_RE);
  if (!match) return null;
  return `sha256:${match[3]}`;
}

function buildGroups(rows: GitChangeRow[]): { groups: ImageGroup[]; ungrouped: GitChangeRow[] } {
  const groupMap = new Map<string, { basePath: string; rows: GitChangeRow[] }>();
  const ungrouped: GitChangeRow[] = [];

  for (const row of rows) {
    const imageId = extractImageId(row.path);
    if (!imageId) {
      ungrouped.push(row);
      continue;
    }

    let entry = groupMap.get(imageId);
    if (!entry) {
      const hash = imageId.replace("sha256:", "");
      const basePath = `objects/${hash.slice(0, 2)}/${hash.slice(2, 4)}/sha256_${hash}`;
      entry = { basePath, rows: [] };
      groupMap.set(imageId, entry);
    }
    entry.rows.push(row);
  }

  const groups: ImageGroup[] = [];
  for (const [imageId, entry] of groupMap) {
    groups.push({ imageId, basePath: entry.basePath, rows: entry.rows });
  }

  return { groups, ungrouped };
}

export function groupChangesByImage(snapshot: GitChangesSnapshot | null): GroupedGitChanges {
  const derived = deriveGitChanges(snapshot);
  const staged = buildGroups(derived.stagedRows);
  const unstaged = buildGroups(derived.unstagedRows);

  return {
    stagedGroups: staged.groups,
    unstagedGroups: unstaged.groups,
    stagedUngrouped: staged.ungrouped,
    unstagedUngrouped: unstaged.ungrouped,
  };
}
