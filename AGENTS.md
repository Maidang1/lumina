# AGENTS.md

This document gives coding agents the project-specific context needed to work safely and quickly.

## Project Overview

Lumina is a photography portfolio web app built with React, TypeScript, and Rsbuild. It supports:

- Masonry gallery with EXIF and map display
- Browser-side image pipeline (EXIF, OCR, pHash, blur detection, dominant color)
- iOS Live Photo upload/playback (still + MOV)
- Cloudflare Pages Functions API backed by GitHub object storage
- Token-protected write APIs and optional signed share URLs

## Build Commands

```bash
# Install dependencies
pnpm install

# Frontend dev server only (port 3000)
pnpm run dev

# Production build (dist/)
pnpm run build

# Cloudflare Pages dev + Functions (requires dist/)
pnpm run dev:pages

# Recommended local full mode: build watch + Pages Functions
pnpm run dev:full

# Preview production build
pnpm run preview

# Deploy dist/ to Cloudflare Pages
pnpm run deploy

# Type check
pnpm run typecheck
```

## Local Development

1. Create local function env file:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
2. Fill required values in `.dev.vars`:
   - `GITHUB_TOKEN`
   - `ALLOW_ORIGIN`
   - `UPLOAD_TOKEN`
   - `SHARE_SIGNING_SECRET` (recommended when using share URLs)
3. Start local development:
   ```bash
   pnpm run dev:full
   ```

## Testing

No test framework is currently configured. If tests are added, prefer Vitest.

## Project Structure

```txt
lumina/
├── src/
│   ├── app/
│   ├── features/photos/
│   │   ├── components/
│   │   │   ├── upload/
│   │   │   ├── photo-detail/
│   │   │   └── hooks/
│   │   ├── services/
│   │   │   └── video-loader/
│   │   └── types.ts
│   ├── shared/
│   │   ├── ui/
│   │   └── lib/
│   └── styles/
├── functions/
│   ├── api/v1/images/
│   │   ├── index.ts
│   │   ├── [id].ts
│   │   ├── [id]/[type].ts
│   │   ├── [id]/live.ts
│   │   └── [id]/share.ts
│   └── utils/
├── schemas/
├── rsbuild.config.ts
├── tsconfig.json
└── wrangler.toml
```

## API Endpoints

```txt
GET    /api/v1/images               # list images (paginated)
POST   /api/v1/images               # upload image + thumb + metadata (+ live video)
GET    /api/v1/images/:id           # get metadata
PATCH  /api/v1/images/:id           # update metadata fields
DELETE /api/v1/images/:id           # delete image assets
GET    /api/v1/images/:id/thumb     # redirect to thumbnail
GET    /api/v1/images/:id/original  # redirect to original
GET    /api/v1/images/:id/live      # redirect to live video
POST   /api/v1/images/:id/share     # generate signed asset URL
```

Mutating APIs require header `x-upload-token`.

## Architecture Notes

- CPU-heavy processing happens in browser workers where possible.
- Image assets are stored in GitHub under `objects/{p1}/{p2}/sha256_{hash}/...`.
- GitHub writes are serialized to reduce rate-limit issues.
- When `SHARE_SIGNING_SECRET` is configured, signed URL access is supported for image/video asset routes.

## Environment Variables

### Frontend (`.env.local`)

- `RSBUILD_API_URL` (optional, default same origin)

### Functions (`.dev.vars` local / Cloudflare production)

- `GITHUB_TOKEN` (required)
- `ALLOW_ORIGIN` (required)
- `UPLOAD_TOKEN` (required for POST/PATCH/DELETE/share)
- `SHARE_SIGNING_SECRET` (optional, recommended)

### `wrangler.toml` vars

- `GH_OWNER`
- `GH_REPO`
- `GH_BRANCH`

## Code Style

- Prefer `interface` for object shapes and `type` for unions/intersections.
- Use explicit parameter/return types.
- Avoid `any`, `@ts-ignore`, and non-null assertions.
- Use React function components with typed props.
- Keep Tailwind usage consistent with existing dark theme tokens.
