import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Dirent } from "node:fs";
import { defineCommand, runMain } from "citty";
import { parseImageFromPath } from "@luminafe/image-core-native";
import type { ImageIndexFile, ImageMetadata } from "@luminafe/contracts";

const execFileAsync = promisify(execFile);
const IMAGE_INDEX_PATH = "objects/_index/images.json";

interface UploadRecord {
  source: string;
  imageId?: string;
  status: "pending" | "processing" | "uploaded" | "failed";
  error?: string;
  retries: number;
}

interface UploadManifest {
  version: 1;
  createdAt: string;
  updatedAt: string;
  records: UploadRecord[];
}

interface UploadOptions {
  repoPath: string;
  concurrency: number;
  ocrConcurrency: number;
  retry: number;
  manifest: string;
}

interface MigrateLayoutResult {
  scannedFiles: number;
  renamedFiles: number;
  removedConflicts: number;
  indexItems: number;
  indexWritten: boolean;
}

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".avif",
]);

const LEGACY_LAYOUT_NAME_MAP: Record<string, string> = {
  "metadata.json": "meta.json",
  "thumb_400.webp": "thumb-400.webp",
  "thumb_800.webp": "thumb-800.webp",
  "thumb_1600.webp": "thumb-1600.webp",
  "thumb_sm.webp": "thumb-400.webp",
  "thumb_md.webp": "thumb-800.webp",
  "thumb_lg.webp": "thumb-1600.webp",
};

let imageIndexWriteChain: Promise<void> = Promise.resolve();

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function sortIndexItems(
  items: Array<{ image_id: string; created_at: string; meta_path: string }>,
): Array<{ image_id: string; created_at: string; meta_path: string }> {
  return items.sort((a, b) => {
    const timeDiff =
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.image_id.localeCompare(a.image_id);
  });
}

function relativeRepoPath(repoPath: string, absPath: string): string {
  const relative = path.relative(repoPath, absPath);
  return toPosixPath(relative);
}

function imageIdToMetaPath(imageId: string): string {
  const hash = imageId.replace(/^sha256:/, "");
  return `objects/${hash.slice(0, 2)}/${hash.slice(2, 4)}/sha256_${hash}/meta.json`;
}

async function runGit(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: repoPath });
  return stdout.trim();
}

async function writeToRepo(
  repoPath: string,
  relativePath: string,
  content: Uint8Array,
): Promise<void> {
  const absPath = path.join(repoPath, relativePath);
  const parentDir = path.dirname(absPath);
  await fs.mkdir(parentDir, { recursive: true });
  await fs.writeFile(absPath, content);
}

async function readImageIndex(repoPath: string): Promise<ImageIndexFile> {
  const indexPath = path.join(repoPath, IMAGE_INDEX_PATH);
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw) as ImageIndexFile;
    if (!Array.isArray(parsed.items)) {
      throw new Error("Invalid index items");
    }
    return {
      version: "1",
      updated_at: parsed.updated_at || new Date().toISOString(),
      items: sortIndexItems(parsed.items),
    };
  } catch {
    return {
      version: "1",
      updated_at: new Date().toISOString(),
      items: [],
    };
  }
}

async function writeImageIndex(
  repoPath: string,
  index: ImageIndexFile,
): Promise<void> {
  const content = new TextEncoder().encode(JSON.stringify(index, null, 2));
  await writeToRepo(repoPath, IMAGE_INDEX_PATH, content);
}

async function upsertImageIndex(
  repoPath: string,
  metadata: ImageMetadata,
): Promise<void> {
  const index = await readImageIndex(repoPath);
  const nextItems = index.items.filter(
    (item) => item.image_id !== metadata.image_id,
  );
  nextItems.push({
    image_id: metadata.image_id,
    created_at: metadata.timestamps.created_at,
    meta_path: imageIdToMetaPath(metadata.image_id),
  });

  const nextIndex: ImageIndexFile = {
    version: "1",
    updated_at: new Date().toISOString(),
    items: sortIndexItems(nextItems),
  };

  await writeImageIndex(repoPath, nextIndex);
}

async function queueIndexUpsert(
  repoPath: string,
  metadata: ImageMetadata,
): Promise<void> {
  const run = async (): Promise<void> => {
    await upsertImageIndex(repoPath, metadata);
  };

  const next = imageIndexWriteChain.then(run, run);
  imageIndexWriteChain = next.then(
    () => undefined,
    () => undefined,
  );
  await next;
}

function getExtension(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
  };
  return map[mime] || "bin";
}

async function collectFiles(inputs: string[]): Promise<string[]> {
  const out: string[] = [];

  async function walk(p: string): Promise<void> {
    const stat = await fs.stat(p);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(p);
      await Promise.all(entries.map((entry) => walk(path.join(p, entry))));
      return;
    }

    const ext = path.extname(p).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      out.push(p);
    }
  }

  for (const input of inputs) {
    await walk(path.resolve(input));
  }

  return out.sort();
}

async function collectMetaFiles(repoPath: string): Promise<string[]> {
  const objectsRoot = path.join(repoPath, "objects");
  const out: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absPath);
        continue;
      }
      if (entry.isFile() && entry.name === "meta.json") {
        out.push(absPath);
      }
    }
  };

  await walk(objectsRoot);
  return out.sort();
}

async function readManifest(manifestPath: string): Promise<UploadManifest> {
  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    return JSON.parse(raw) as UploadManifest;
  } catch {
    const now = new Date().toISOString();
    return {
      version: 1,
      createdAt: now,
      updatedAt: now,
      records: [],
    };
  }
}

async function writeManifest(
  manifestPath: string,
  manifest: UploadManifest,
): Promise<void> {
  manifest.updatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic") return "image/heic";
  if (ext === ".heif") return "image/heif";
  if (ext === ".avif") return "image/avif";
  return "application/octet-stream";
}

async function uploadOne(
  filePath: string,
  options: UploadOptions,
): Promise<{ ok: true; imageId: string } | { ok: false; error: string }> {
  try {
    const result = await parseImageFromPath(filePath, guessMime(filePath), {
      maxThumbSize: 1024,
      thumbQuality: 0.78,
      blurThreshold: 100,
      enableRegionResolve: true,
      generateThumbVariants: true,
    });

    const metadata = result.metadata as unknown as ImageMetadata;
    const imageId = metadata.image_id;
    const hash = imageId.replace(/^sha256:/, "");
    const prefix = `objects/${hash.slice(0, 2)}/${hash.slice(2, 4)}/sha256_${hash}`;

    await writeToRepo(
      options.repoPath,
      `${prefix}/original.${getExtension(result.normalizedOriginalMime)}`,
      new Uint8Array(result.normalizedOriginalBytes),
    );

    await writeToRepo(
      options.repoPath,
      `${prefix}/thumb.webp`,
      new Uint8Array(result.thumbBytes),
    );

    for (const [key, buffer] of Object.entries(result.thumbVariants)) {
      if (key === "400" || key === "800" || key === "1600") {
        await writeToRepo(
          options.repoPath,
          `${prefix}/thumb-${key}.webp`,
          new Uint8Array(buffer),
        );
      }
    }

    await writeToRepo(
      options.repoPath,
      `${prefix}/meta.json`,
      new TextEncoder().encode(JSON.stringify(metadata, null, 2)),
    );

    await queueIndexUpsert(options.repoPath, metadata);

    return { ok: true, imageId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "upload failed",
    };
  }
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

async function handleUpload(
  input: string[],
  options: UploadOptions,
): Promise<void> {
  const files = await collectFiles(input);
  const manifest = await readManifest(options.manifest);

  for (const file of files) {
    if (!manifest.records.find((r) => r.source === file)) {
      manifest.records.push({ source: file, status: "pending", retries: 0 });
    }
  }

  const pending = manifest.records.filter((r) => r.status !== "uploaded");
  let success = manifest.records.filter((r) => r.status === "uploaded").length;
  let failed = manifest.records.filter((r) => r.status === "failed").length;

  await runPool(pending, options.concurrency, async (record) => {
    record.status = "processing";
    await writeManifest(options.manifest, manifest);

    const result = await uploadOne(record.source, options);
    if (result.ok) {
      record.status = "uploaded";
      record.imageId = result.imageId;
      record.error = undefined;
      success += 1;
    } else {
      record.retries += 1;
      record.error = result.error;
      record.status = record.retries >= options.retry ? "failed" : "pending";
      if (record.status === "failed") failed += 1;
    }

    await writeManifest(options.manifest, manifest);
    process.stdout.write(
      `[lumina-upload] total=${manifest.records.length} success=${success} failed=${failed} pending=${manifest.records.filter((r) => r.status !== "uploaded").length}\n`,
    );
  });

  const finalPending = manifest.records.filter(
    (r) => r.status === "pending" || r.status === "processing",
  );
  if (finalPending.length > 0) {
    process.stdout.write(
      `[lumina-upload] ${finalPending.length} item(s) remain pending. run resume to continue.\n`,
    );
    process.exitCode = 2;
  } else if (manifest.records.some((r) => r.status === "failed")) {
    process.exitCode = 1;
  }
}

async function handleResume(options: UploadOptions): Promise<void> {
  const manifest = await readManifest(options.manifest);
  const toRetry = manifest.records
    .filter((r) => r.status !== "uploaded")
    .map((r) => r.source);
  await handleUpload(toRetry, options);
}

async function handleValidate(input: string[]): Promise<void> {
  const files = await collectFiles(input);
  process.stdout.write(
    JSON.stringify({ count: files.length, files }, null, 2) + "\n",
  );
}

async function rebuildImageIndex(
  repoPath: string,
  apply: boolean,
): Promise<{ items: number; written: boolean }> {
  const metaFiles = await collectMetaFiles(repoPath);
  const items: Array<{ image_id: string; created_at: string; meta_path: string }> = [];

  for (const absMetaPath of metaFiles) {
    try {
      const raw = await fs.readFile(absMetaPath, "utf-8");
      const metadata = JSON.parse(raw) as ImageMetadata;
      if (!metadata.image_id || !metadata.timestamps?.created_at) {
        continue;
      }
      items.push({
        image_id: metadata.image_id,
        created_at: metadata.timestamps.created_at,
        meta_path: relativeRepoPath(repoPath, absMetaPath),
      });
    } catch {
      // ignore malformed metadata
    }
  }

  const index: ImageIndexFile = {
    version: "1",
    updated_at: new Date().toISOString(),
    items: sortIndexItems(items),
  };

  if (apply) {
    await writeImageIndex(repoPath, index);
  }

  return {
    items: index.items.length,
    written: apply,
  };
}

async function handleMigrateLayout(
  repoPath: string,
  apply: boolean,
): Promise<MigrateLayoutResult> {
  const objectsRoot = path.join(repoPath, "objects");
  const legacyFiles: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (LEGACY_LAYOUT_NAME_MAP[entry.name]) {
        legacyFiles.push(absPath);
      }
    }
  };

  await walk(objectsRoot);

  let renamedFiles = 0;
  let removedConflicts = 0;

  for (const fromAbsPath of legacyFiles.sort()) {
    const fromName = path.basename(fromAbsPath);
    const nextName = LEGACY_LAYOUT_NAME_MAP[fromName];
    if (!nextName) {
      continue;
    }

    const toAbsPath = path.join(path.dirname(fromAbsPath), nextName);
    if (!apply) {
      process.stdout.write(
        `[dry-run] ${relativeRepoPath(repoPath, fromAbsPath)} -> ${relativeRepoPath(repoPath, toAbsPath)}\n`,
      );
      continue;
    }

    try {
      await fs.access(toAbsPath);
      await fs.unlink(fromAbsPath);
      removedConflicts += 1;
      continue;
    } catch {
      // target does not exist, proceed with rename.
    }

    await fs.mkdir(path.dirname(toAbsPath), { recursive: true });
    await fs.rename(fromAbsPath, toAbsPath);
    renamedFiles += 1;
  }

  const indexSummary = await rebuildImageIndex(repoPath, apply);

  if (!apply) {
    process.stdout.write(
      `[dry-run] image index rebuild: ${indexSummary.items} item(s) would be written to ${IMAGE_INDEX_PATH}\n`,
    );
  }

  return {
    scannedFiles: legacyFiles.length,
    renamedFiles,
    removedConflicts,
    indexItems: indexSummary.items,
    indexWritten: indexSummary.written,
  };
}

async function handleSync(repoPath: string, message?: string): Promise<void> {
  await runGit(repoPath, ["add", "objects"]);

  try {
    await execFileAsync("git", ["diff", "--cached", "--quiet"], {
      cwd: repoPath,
    });
    process.stdout.write("[lumina-upload] Nothing to commit\n");
    return;
  } catch {
    // has staged changes, continue
  }

  const commitMessage =
    message || `lumina: sync assets ${new Date().toISOString()}`;
  await runGit(repoPath, ["commit", "-m", commitMessage]);

  const branch = await runGit(repoPath, [
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]);
  await runGit(repoPath, ["pull", "--rebase", "origin", branch]);
  await runGit(repoPath, ["push", "origin", branch]);

  process.stdout.write("[lumina-upload] Commit and push completed\n");
}

const uploadCommand = defineCommand({
  meta: {
    name: "upload",
    description: "Upload photos to local git repository",
  },
  args: {
    input: {
      type: "positional",
      description: "File or directory paths",
      required: true,
    },
    "repo-path": {
      type: "string",
      description: "Local git repository path",
      default: process.env.LUMINA_REPO_PATH,
    },
    concurrency: {
      type: "string",
      description: "Upload concurrency",
      default: "4",
    },
    "ocr-concurrency": {
      type: "string",
      description: "OCR concurrency",
      default: "2",
    },
    retry: {
      type: "string",
      description: "Retry attempts",
      default: "5",
    },
    manifest: {
      type: "string",
      description: "Manifest path",
      default: ".lumina-upload-manifest.json",
    },
  },
  async run({ args }) {
    if (!args["repo-path"]) {
      throw new Error(
        "--repo-path is required (or set env LUMINA_REPO_PATH)",
      );
    }

    const input = Array.isArray(args.input) ? args.input : [args.input];
    await handleUpload(input, {
      repoPath: args["repo-path"],
      concurrency: Number(args.concurrency),
      ocrConcurrency: Number(args["ocr-concurrency"]),
      retry: Number(args.retry),
      manifest: args.manifest,
    });
  },
});

const resumeCommand = defineCommand({
  meta: {
    name: "resume",
    description: "Resume pending uploads from manifest",
  },
  args: {
    "repo-path": {
      type: "string",
      description: "Local git repository path",
      default: process.env.LUMINA_REPO_PATH,
    },
    concurrency: {
      type: "string",
      description: "Upload concurrency",
      default: "4",
    },
    "ocr-concurrency": {
      type: "string",
      description: "OCR concurrency",
      default: "2",
    },
    retry: {
      type: "string",
      description: "Retry attempts",
      default: "5",
    },
    manifest: {
      type: "string",
      description: "Manifest path",
      default: ".lumina-upload-manifest.json",
    },
  },
  async run({ args }) {
    if (!args["repo-path"]) {
      throw new Error(
        "--repo-path is required (or set env LUMINA_REPO_PATH)",
      );
    }

    await handleResume({
      repoPath: args["repo-path"],
      concurrency: Number(args.concurrency),
      ocrConcurrency: Number(args["ocr-concurrency"]),
      retry: Number(args.retry),
      manifest: args.manifest,
    });
  },
});

const validateCommand = defineCommand({
  meta: {
    name: "validate",
    description: "Validate and list image files",
  },
  args: {
    input: {
      type: "positional",
      description: "File or directory paths",
      required: true,
    },
  },
  async run({ args }) {
    const input = Array.isArray(args.input) ? args.input : [args.input];
    await handleValidate(input);
  },
});

const migrateLayoutCommand = defineCommand({
  meta: {
    name: "migrate-layout",
    description: "Migrate legacy object layout to meta.json + thumb-{size}.webp and rebuild index",
  },
  args: {
    "repo-path": {
      type: "string",
      description: "Local git repository path",
      required: true,
    },
    apply: {
      type: "boolean",
      description: "Apply changes (default is dry-run)",
      default: false,
    },
  },
  async run({ args }) {
    const result = await handleMigrateLayout(args["repo-path"], Boolean(args.apply));
    process.stdout.write(
      JSON.stringify(
        {
          mode: args.apply ? "apply" : "dry-run",
          ...result,
        },
        null,
        2,
      ) + "\n",
    );
  },
});

const syncCommand = defineCommand({
  meta: {
    name: "sync",
    description: "Commit and push changes to remote repository",
  },
  args: {
    "repo-path": {
      type: "string",
      description: "Local git repository path",
      required: true,
    },
    message: {
      type: "string",
      description: "Commit message",
    },
  },
  async run({ args }) {
    await handleSync(args["repo-path"], args.message);
  },
});

const main = defineCommand({
  meta: {
    name: "lumina-upload",
    description: "Batch upload photos to local git repository for Lumina",
    version: "0.1.0",
  },
  subCommands: {
    upload: uploadCommand,
    resume: resumeCommand,
    validate: validateCommand,
    "migrate-layout": migrateLayoutCommand,
    sync: syncCommand,
  },
});

runMain(main);
