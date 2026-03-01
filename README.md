# Lumina Monorepo

Lumina is a photography portfolio monorepo built with React, TypeScript, Rsbuild, and Cloudflare Pages Functions.

## Features

- Masonry gallery with EXIF and map display
- Local image processing (via CLI or Desktop app)
- Cloudflare Pages Functions read-only API backed by GitHub object storage
- Unified object layout: `meta.json`, `thumb-400.webp|thumb-800.webp|thumb-1600.webp`, `objects/_index/images.json`

## Workspace Layout

- `apps/web`: React frontend + Cloudflare Pages Functions API
- `apps/desktop`: Tauri desktop application
- `packages/contracts`: shared metadata/types/path helpers
- `packages/github-storage`: GitHub object/index storage client
- `packages/image-core-native`: Rust native image processing module
- `packages/cli`: `lumina-upload` batch upload CLI

## Quick Start

```bash
pnpm install
pnpm run dev:web
```

For full local mode (frontend build watch + Pages Functions):

```bash
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm run dev:full
```

Required values in `apps/web/.dev.vars`:

- `GITHUB_TOKEN`
- `ALLOW_ORIGIN`

`apps/web/wrangler.toml` vars:

- `GH_OWNER`
- `GH_REPO`
- `GH_BRANCH`

Frontend optional vars in `.env.local` / `.env`:

- `RSBUILD_GH_OWNER` (for direct jsDelivr asset URL generation)
- `RSBUILD_GH_REPO`
- `RSBUILD_GH_BRANCH`

## Scripts

- `pnpm run build`: build all workspaces via turbo
- `pnpm run typecheck`: typecheck all workspaces
- `pnpm run dev:web`: run web dev server only
- `pnpm run dev:pages`: serve built web app with Cloudflare Pages Functions
- `pnpm run dev:full`: run web build watch + Cloudflare Pages Functions
- `pnpm run cli:build`: build CLI package
- `pnpm run cli:dev`: run CLI package in dev mode
- `pnpm run cli:pack`: dry-run npm package contents for CLI
- `pnpm run cli:publish`: publish CLI package to npm (public)
- `pnpm knip`: dependency and dead-code scan

## Desktop Release

Desktop release is automated by GitHub Actions on tag push.

- Workflow file: `.github/workflows/release-desktop.yml`
- Trigger tag format: `desktop-vX.Y.Z` (example: `desktop-v0.1.0`)
- Supported platforms:
  - macOS (ARM64 / x86_64) → `.dmg`
  - Windows (x64) → `.exe` (NSIS installer)
  - Linux (x64) → `.AppImage`, `.deb`
- Signing/notarization: not enabled yet

Before pushing a release tag, ensure `apps/desktop/src-tauri/tauri.conf.json` `version`
matches the tag version.

Example release commands:

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

## API Endpoints

```txt
GET    /api/v1/images               # list images (paginated)
GET    /api/v1/images/:id           # get metadata
GET    /api/v1/images/:id/thumb     # redirect to thumbnail
GET    /api/v1/images/:id/original  # redirect to original
```

## CLI

Main commands:

- `lumina-upload upload <input...>` - Upload images to local git repository
- `lumina-upload sync` - Commit and push changes to remote
- `lumina-upload resume` - Resume pending uploads
- `lumina-upload validate <input...>` - Validate image files
- `lumina-upload migrate-layout --repo-path <path> [--apply]` - Migrate legacy layout and rebuild index (`--apply` omitted = dry-run)

Example:

```bash
# Upload images to local repository
lumina-upload upload ./photos --repo-path /path/to/local/repo

# Sync to remote
lumina-upload sync --repo-path /path/to/local/repo --message "Add new photos"
```

Environment variable alternatives:

- `LUMINA_REPO_PATH` - Local git repository path

Publish flow:

```bash
pnpm run cli:build
pnpm run cli:pack
pnpm run cli:publish
```

First release of a scoped package requires public access:

```bash
npm login
pnpm run cli:publish
```
