# Lumina

Photography portfolio web app built with React + TypeScript + Rsbuild, using Cloudflare Pages Functions as the API layer and GitHub as object storage.

## Features

- Masonry gallery with EXIF info and map view
- Browser-side processing pipeline:
  - SHA-256 ID generation
  - Thumbnail generation (WebP)
  - EXIF extraction + region resolving (province/city)
  - GPS sanitization before metadata persistence
  - OCR (Tesseract.js)
  - Dominant color extraction
  - Blur detection (Laplacian variance)
  - Perceptual hash (blockhash)
- iOS Live Photo support (image + MOV)
- Token-protected upload/update/delete/share APIs
- Optional signed share URLs for asset access

## Tech Stack

- React 19
- TypeScript
- Rsbuild
- Tailwind CSS
- Cloudflare Pages Functions
- FFmpeg (WASM)
- Wrangler

## Requirements

- Node.js 18+
- pnpm

## Quick Start

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create local function env file:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
3. Configure `.dev.vars`:
   - `GITHUB_TOKEN`
   - `ALLOW_ORIGIN`
   - `UPLOAD_TOKEN`
   - `SHARE_SIGNING_SECRET` (recommended)
4. Start local full mode:
   ```bash
   pnpm run dev:full
   ```

## Scripts

- `pnpm run dev`: frontend only (`3000`)
- `pnpm run build`: build to `dist/`
- `pnpm run dev:pages`: run Pages + Functions from `dist/` (`8788`)
- `pnpm run dev:full`: build watch + Pages Functions
- `pnpm run preview`: preview production build
- `pnpm run typecheck`: TypeScript type check
- `pnpm run deploy`: deploy `dist/` to Cloudflare Pages

## Environment Variables

Frontend (`.env.local`):

- `RSBUILD_API_URL` (optional, defaults to same origin)

Functions (`.dev.vars` local / Cloudflare production):

- `GITHUB_TOKEN`: GitHub PAT with `repo` scope
- `ALLOW_ORIGIN`: CORS allow origin (example `http://localhost:3000`)
- `UPLOAD_TOKEN`: required for write routes (`POST/PATCH/DELETE` and share generation)
- `SHARE_SIGNING_SECRET`: optional but recommended for signed share URLs

Configured in `wrangler.toml`:

- `GH_OWNER`
- `GH_REPO`
- `GH_BRANCH`

## API Endpoints

- `GET /api/v1/images`: list images (paginated)
- `POST /api/v1/images`: upload original + thumbnail + metadata (+ live video)
- `GET /api/v1/images/:id`: fetch metadata
- `PATCH /api/v1/images/:id`: update metadata whitelist (`description`, `original_filename`, `privacy`, `geo`, `processing`)
- `DELETE /api/v1/images/:id`: delete image assets
- `GET /api/v1/images/:id/thumb`: redirect to thumbnail
- `GET /api/v1/images/:id/original`: redirect to original
- `GET /api/v1/images/:id/live`: redirect to live video
- `POST /api/v1/images/:id/share`: generate signed asset URL

## Project Structure

```txt
src/
  app/
  features/photos/
    components/
      upload/
      photo-detail/
      hooks/
    services/
      video-loader/
    types.ts
  shared/
  styles/
functions/
  api/v1/images/
  utils/
schemas/
  image-meta.schema.json
```
