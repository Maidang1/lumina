# Lumina Monorepo

Lumina is a photography portfolio monorepo built with React, TypeScript, Rsbuild, and Cloudflare Pages Functions.

## Features

- Masonry gallery with EXIF and map display
- Browser-side image pipeline (EXIF, OCR, pHash, blur detection, dominant color)
- iOS Live Photo upload/playback (still + MOV)
- Cloudflare Pages Functions API backed by GitHub object storage
- Token-protected write APIs and optional signed share URLs

## Workspace Layout

- `apps/web`: React frontend + Cloudflare Pages Functions API
- `packages/contracts`: shared metadata/types/path helpers
- `packages/github-storage`: GitHub object/index storage client
- `packages/upload-core`: upload preprocessing pipeline (Node + browser entry)
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
- `UPLOAD_TOKEN`
- `SHARE_SIGNING_SECRET` (recommended)

`apps/web/wrangler.toml` vars:

- `GH_OWNER`
- `GH_REPO`
- `GH_BRANCH`

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

## API Endpoints

```txt
GET    /api/v1/images
POST   /api/v1/images
GET    /api/v1/images/:id
PATCH  /api/v1/images/:id
DELETE /api/v1/images/:id
GET    /api/v1/images/:id/thumb
GET    /api/v1/images/:id/original
GET    /api/v1/images/:id/live
POST   /api/v1/images/:id/share
```

Mutating APIs require header `x-upload-token`.

## CLI

Main commands:

- `lumina-upload upload <input...>`
- `lumina-upload resume`
- `lumina-upload validate <input...>`

Example:

```bash
lumina-upload \
  --owner your-owner \
  --repo your-repo \
  --token ghp_xxx \
  --branch main \
  --concurrency 4 \
  upload ./photos
```

Environment variable alternatives:

- `LUMINA_GITHUB_TOKEN`
- `LUMINA_GH_OWNER`
- `LUMINA_GH_REPO`
- `LUMINA_GH_BRANCH`

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
