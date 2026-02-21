import fs from "node:fs/promises";
import path from "node:path";
import { defineCommand, runMain } from "citty";
import { createGitHubClient } from "@luminafe/github-storage";
import { processForUpload } from "@luminafe/upload-core/node";
import type { Env } from "@luminafe/contracts";

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
  owner: string;
  repo: string;
  branch: string;
  token: string;
  concurrency: number;
  ocrConcurrency: number;
  retry: number;
  manifest: string;
  livePhotoMode: "none" | "pair-by-name";
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".avif"]);

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

async function writeManifest(manifestPath: string, manifest: UploadManifest): Promise<void> {
  manifest.updatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

function getEnvConfig(options: UploadOptions): Env {
  return {
    GITHUB_TOKEN: options.token,
    GH_OWNER: options.owner,
    GH_REPO: options.repo,
    GH_BRANCH: options.branch,
    ALLOW_ORIGIN: "*",
    UPLOAD_TOKEN: "",
    SHARE_SIGNING_SECRET: undefined,
  };
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

async function findLiveVideo(filePath: string): Promise<string | undefined> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const candidateMov = path.join(dir, `${base}.mov`);
  try {
    await fs.access(candidateMov);
    return candidateMov;
  } catch {
    return undefined;
  }
}

async function uploadOne(
  filePath: string,
  options: UploadOptions
): Promise<{ ok: true; imageId: string } | { ok: false; error: string }> {
  try {
    const bytes = new Uint8Array(await fs.readFile(filePath));
    const livePath = options.livePhotoMode === "pair-by-name" ? await findLiveVideo(filePath) : undefined;

    const processed = await processForUpload({
      fileName: path.basename(filePath),
      mimeType: guessMime(filePath),
      bytes,
      ...(livePath
        ? {
            liveVideo: {
              fileName: path.basename(livePath),
              mimeType: "video/quicktime",
              bytes: new Uint8Array(await fs.readFile(livePath)),
            },
          }
        : {}),
    });

    const github = createGitHubClient(getEnvConfig(options), {
      retryMaxAttempts: options.retry,
    });

    await github.uploadImage(
      bytes,
      processed.metadata.files.original.mime,
      processed.thumb,
      processed.metadata,
      processed.metadata.files.live_video
        ? {
            bytes: new Uint8Array(await fs.readFile(livePath!)),
            mime: processed.metadata.files.live_video.mime,
          }
        : undefined
    );

    return { ok: true, imageId: processed.metadata.image_id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "upload failed" };
  }
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
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

async function handleUpload(input: string[], options: UploadOptions): Promise<void> {
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
      `[lumina-upload] total=${manifest.records.length} success=${success} failed=${failed} pending=${manifest.records.filter((r) => r.status !== "uploaded").length}\n`
    );
  });

  const finalPending = manifest.records.filter((r) => r.status === "pending" || r.status === "processing");
  if (finalPending.length > 0) {
    process.stdout.write(`[lumina-upload] ${finalPending.length} item(s) remain pending. run resume to continue.\n`);
    process.exitCode = 2;
  } else if (manifest.records.some((r) => r.status === "failed")) {
    process.exitCode = 1;
  }
}

async function handleResume(options: UploadOptions): Promise<void> {
  const manifest = await readManifest(options.manifest);
  const toRetry = manifest.records.filter((r) => r.status !== "uploaded").map((r) => r.source);
  await handleUpload(toRetry, options);
}

async function handleValidate(input: string[]): Promise<void> {
  const files = await collectFiles(input);
  process.stdout.write(JSON.stringify({ count: files.length, files }, null, 2) + "\n");
}

const uploadCommand = defineCommand({
  meta: {
    name: "upload",
    description: "Upload photos to GitHub objects",
  },
  args: {
    input: {
      type: "positional",
      description: "File or directory paths",
      required: true,
    },
    owner: {
      type: "string",
      description: "GitHub owner",
      default: process.env.LUMINA_GH_OWNER,
    },
    repo: {
      type: "string",
      description: "GitHub repo",
      default: process.env.LUMINA_GH_REPO,
    },
    branch: {
      type: "string",
      description: "GitHub branch",
      default: process.env.LUMINA_GH_BRANCH || "main",
    },
    token: {
      type: "string",
      description: "GitHub token",
      default: process.env.LUMINA_GITHUB_TOKEN,
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
    "live-photo-mode": {
      type: "string",
      description: "none|pair-by-name",
      default: "pair-by-name",
    },
  },
  async run({ args }) {
    if (!args.owner || !args.repo || !args.token) {
      throw new Error("--owner --repo --token are required (or set env LUMINA_GH_OWNER/LUMINA_GH_REPO/LUMINA_GITHUB_TOKEN)");
    }

    const input = Array.isArray(args.input) ? args.input : [args.input];
    await handleUpload(input, {
      owner: args.owner,
      repo: args.repo,
      branch: args.branch,
      token: args.token,
      concurrency: Number(args.concurrency),
      ocrConcurrency: Number(args["ocr-concurrency"]),
      retry: Number(args.retry),
      manifest: args.manifest,
      livePhotoMode: args["live-photo-mode"] as "none" | "pair-by-name",
    });
  },
});

const resumeCommand = defineCommand({
  meta: {
    name: "resume",
    description: "Resume pending uploads from manifest",
  },
  args: {
    owner: {
      type: "string",
      description: "GitHub owner",
      default: process.env.LUMINA_GH_OWNER,
    },
    repo: {
      type: "string",
      description: "GitHub repo",
      default: process.env.LUMINA_GH_REPO,
    },
    branch: {
      type: "string",
      description: "GitHub branch",
      default: process.env.LUMINA_GH_BRANCH || "main",
    },
    token: {
      type: "string",
      description: "GitHub token",
      default: process.env.LUMINA_GITHUB_TOKEN,
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
    "live-photo-mode": {
      type: "string",
      description: "none|pair-by-name",
      default: "pair-by-name",
    },
  },
  async run({ args }) {
    if (!args.owner || !args.repo || !args.token) {
      throw new Error("--owner --repo --token are required (or set env LUMINA_GH_OWNER/LUMINA_GH_REPO/LUMINA_GITHUB_TOKEN)");
    }

    await handleResume({
      owner: args.owner,
      repo: args.repo,
      branch: args.branch,
      token: args.token,
      concurrency: Number(args.concurrency),
      ocrConcurrency: Number(args["ocr-concurrency"]),
      retry: Number(args.retry),
      manifest: args.manifest,
      livePhotoMode: args["live-photo-mode"] as "none" | "pair-by-name",
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

const main = defineCommand({
  meta: {
    name: "lumina-upload",
    description: "Batch upload photos to GitHub objects for Lumina",
    version: "0.1.0",
  },
  subCommands: {
    upload: uploadCommand,
    resume: resumeCommand,
    validate: validateCommand,
  },
});

runMain(main);
