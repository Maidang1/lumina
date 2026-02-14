# Lumina

Professional photography portfolio web app built with React + TypeScript + Rsbuild, with Cloudflare Pages Functions as API layer and GitHub as object storage.

## Features

- Masonry photo gallery with EXIF display
- Browser-side image processing:
  - SHA-256 deduplication id
  - Thumbnail generation (WebP)
  - EXIF extraction and GPS removal
  - OCR (Tesseract.js)
  - Dominant color extraction
  - Blur detection (variance of Laplacian)
  - Perceptual hash (blockhash)
- iOS Live Photo support:
  - Still image extraction and upload
  - MOV video storage
  - Playback in detail view
- Upload pipeline to Cloudflare Pages Functions
- GitHub-backed storage for original image, thumbnail, metadata, and live video

## Tech Stack

- React 19
- TypeScript
- Rsbuild
- Tailwind CSS
- Cloudflare Pages Functions
- FFmpeg (video processing)
- Wrangler

## Requirements

- Node.js 18+
- pnpm

## Quick Start

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create local function vars:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
3. Edit `.dev.vars` and set `GITHUB_TOKEN`.
4. Start full local dev mode:
   ```bash
   pnpm run dev:full
   ```

## Scripts

- `pnpm run dev`: Frontend dev server only (port `3000`)
- `pnpm run build`: Build production assets to `dist/`
- `pnpm run dev:pages`: Run Cloudflare Pages + Functions from `dist/` (port `8788`)
- `pnpm run dev:full`: Build watch + Pages Functions (recommended when testing API)
- `pnpm run preview`: Preview production build
- `pnpm run typecheck`: TypeScript type checking
- `pnpm run deploy`: Deploy `dist/` to Cloudflare Pages

## Environment Variables

Frontend (`.env.local`):

- `RSBUILD_API_URL` (optional): API base URL, defaults to same origin

Cloudflare Pages Functions (`.dev.vars` locally / Cloudflare dashboard in production):

- `GITHUB_TOKEN`: PAT with `repo` scope
- `ALLOW_ORIGIN`: CORS allowlist origin (e.g. `http://localhost:3000`)

Configured in `wrangler.toml`:

- `GH_OWNER`
- `GH_REPO`
- `GH_BRANCH`

## Project Structure

```txt
src/
  app/
    App.tsx
    main.tsx
  features/
    photos/
      components/
      services/
      types.ts
  shared/
    ui/
    lib/
      utils.ts
  styles/
    main.css
functions/
  _utils.ts
  api/v1/images/
schemas/
  image-meta.schema.json
```

## API Endpoints

- `POST /api/v1/images`: upload original + thumbnail + metadata
- `GET /api/v1/images`: list images (paginated)
- `GET /api/v1/images/:id`: get metadata
- `GET /api/v1/images/:id/thumb`: redirect to thumbnail
- `GET /api/v1/images/:id/original`: redirect to original
- `GET /api/v1/images/:id/live`: redirect to live video (when available)
