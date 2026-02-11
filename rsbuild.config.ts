import path from "path";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const apiTarget = process.env.RSBUILD_API_URL || "http://localhost:8787";

export default defineConfig({
  plugins: [
    pluginReact({
      swcReactOptions: {
        development: process.env.NODE_ENV === "development",
      },
    }),
  ],
  source: {
    entry: {
      index: "./index.tsx",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  html: {
    template: "./index.html",
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        pathRewrite: {
          "^/api": "",
        },
      },
    },
  },
});
