import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node20",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: ["citty", "exifr", "sharp", "tesseract.js"],
});
