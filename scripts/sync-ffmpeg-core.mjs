import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const coreEntryPath = require.resolve("@ffmpeg/core");
const srcDir = path.dirname(coreEntryPath);
const destDir = path.join(rootDir, "public", "ffmpeg");

async function main() {
  await mkdir(destDir, { recursive: true });

  await copyFile(path.join(srcDir, "ffmpeg-core.js"), path.join(destDir, "ffmpeg-core.js"));
  await copyFile(path.join(srcDir, "ffmpeg-core.wasm"), path.join(destDir, "ffmpeg-core.wasm"));

  console.log("[sync-ffmpeg-core] copied ffmpeg-core.js/ffmpeg-core.wasm to public/ffmpeg");
}

main().catch((error) => {
  console.error("[sync-ffmpeg-core] failed:", error);
  process.exit(1);
});
