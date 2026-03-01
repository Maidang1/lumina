# AGENTS.md

This document gives coding agents the project-specific context needed to work safely and quickly.

## Project Overview

Lumina is a monorepo photography portfolio project built with React, TypeScript, and Rsbuild. It supports:

- Masonry gallery with EXIF and map display
- Local image processing (via CLI or Desktop app)
- Cloudflare Pages Functions read-only API backed by GitHub object storage
- Unified object layout:
  - metadata file: `meta.json`
  - thumb variants: `thumb-400.webp`, `thumb-800.webp`, `thumb-1600.webp`
  - image index: `objects/_index/images.json`

## Build Commands

```bash
# Install dependencies
pnpm install

# Frontend dev server only (port 3000)
pnpm run dev:web

# Production build (all workspaces)
pnpm run build

# Cloudflare Pages dev + Functions for web app (requires dist/)
pnpm run dev:pages

# Recommended local full mode: build watch + Pages Functions
pnpm run dev:full

# Type check
pnpm run typecheck

# Dead code/dependency check
pnpm run knip

# Build CLI package
pnpm run cli:build

# Dry-run CLI npm package
pnpm run cli:pack

# Publish CLI npm package (public)
pnpm run cli:publish
```

## Desktop Release (GitHub Actions)

- Workflow: `.github/workflows/release-desktop.yml`
- Trigger: push tag `desktop-vX.Y.Z` (for example `desktop-v0.1.0`)
- Supported platforms:
  - macOS (ARM64 / x86_64) → `.dmg`
  - Windows (x64) → `.exe` (NSIS installer)
  - Linux (x64) → `.AppImage`, `.deb`
- Signing/notarization: currently disabled
- Version rule: tag version must match `apps/desktop/src-tauri/tauri.conf.json` `version`

## Local Development

1. Create local function env file:
   ```bash
   cp apps/web/.dev.vars.example apps/web/.dev.vars
   ```
2. Fill required values in `apps/web/.dev.vars`:
   - `GITHUB_TOKEN`
   - `ALLOW_ORIGIN`
3. Start local development:
   ```bash
   pnpm run dev:full
   ```

## Testing

No test framework is currently configured. If tests are added, prefer Vitest.

## Project Structure

```txt
lumina/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── functions/
│   │   ├── rsbuild.config.ts
│   │   ├── tsconfig.json
│   │   └── wrangler.toml
│   └── desktop/
├── packages/
│   ├── gallery-core/
│   ├── contracts/
│   ├── github-storage/
│   ├── image-core-native/
│   └── cli/
├── crates/
│   └── lumina-image/
├── pnpm-workspace.yaml
└── turbo.json
```

## API Endpoints

```txt
GET    /api/v1/images               # list images (paginated)
GET    /api/v1/images/:id           # get metadata
GET    /api/v1/images/:id/thumb     # redirect to thumbnail
GET    /api/v1/images/:id/original  # redirect to original
```

## Architecture Notes

- Image upload is done via local git operations (CLI or Desktop writes to local repo, then git push)
- Image assets are stored in GitHub under `objects/{p1}/{p2}/sha256_{hash}/...`
- `github-storage` package is used by Cloudflare Functions to read GitHub data

## Environment Variables

### Frontend (`apps/web/.env.local`)

- `RSBUILD_API_URL` (optional, default same origin)
- `RSBUILD_GH_OWNER` (optional, used to build direct jsDelivr asset URLs)
- `RSBUILD_GH_REPO` (optional)
- `RSBUILD_GH_BRANCH` (optional)

### Functions (`apps/web/.dev.vars` local / Cloudflare production)

- `GITHUB_TOKEN` (required)
- `ALLOW_ORIGIN` (required)

### `apps/web/wrangler.toml` vars

- `GH_OWNER`
- `GH_REPO`
- `GH_BRANCH`

## Code Style

- Prefer `interface` for object shapes and `type` for unions/intersections.
- Use explicit parameter/return types.
- Avoid `any`, `@ts-ignore`, and non-null assertions.
- Use React function components with typed props.
- Keep Tailwind usage consistent with existing dark theme tokens.

## Agent Workflow Notes

- Keep `README.md` and `AGENTS.md` aligned when scripts, env vars, or API routes change.
- Prefer `rg`/`rg --files` for repo search.
- Avoid broad refactors unless requested; keep doc edits scoped to actual behavior.
