# AGENTS.md

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

Lumina is a professional photography portfolio web application built with React, TypeScript, and Rsbuild. It features:
- Masonry photo gallery with EXIF data display
- Browser-side image processing (EXIF, OCR, perceptual hash, blur detection)
- Image upload with GitHub storage backend
- Deployed on Cloudflare Pages with Pages Functions API

## Build Commands

```bash
# Install dependencies
pnpm install

# Start frontend dev server only (port 3000)
pnpm run dev

# Build for production (outputs to dist/)
pnpm run build

# Start Cloudflare Pages dev with Functions (requires build first)
pnpm run dev:pages

# Full dev mode: build watch + Pages dev (recommended for Functions testing)
pnpm run dev:full

# Preview production build locally
pnpm run preview

# Deploy to Cloudflare Pages
pnpm run deploy

# TypeScript type check
pnpm run typecheck
```

### Local Development Modes

| Command | Description | Port |
|---------|-------------|------|
| `pnpm run dev` | Frontend only (Rsbuild) | 3000 |
| `pnpm run dev:pages` | Pages + Functions (requires `pnpm run build` first) | 8788 |
| `pnpm run dev:full` | Build watch + Pages + Functions | 8788 |

### Local Development Setup

1. Create `.dev.vars` file:
   ```bash
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars and add your GITHUB_TOKEN
   ```

2. Start development:
   ```bash
   # Full development mode
   pnpm run dev:full
   
   # Or step by step:
   pnpm run build
   pnpm run dev:pages
   ```

## Testing

No test framework is currently configured. If tests are added, prefer Vitest.

## Project Structure

```
lumina/
├── components/         # React components (kebab-case filenames)
│   ├── PhotoCard.tsx
│   ├── PhotoDetail.tsx
│   ├── PhotoGrid.tsx
│   ├── Histogram.tsx
│   ├── UploadButton.tsx
│   ├── UploadModal.tsx
│   └── ProcessingProgress.tsx
├── services/           # Client-side services
│   ├── imageProcessor.ts    # Thumbnail, color, blur detection
│   ├── exifExtractor.ts     # EXIF parsing + GPS removal
│   ├── ocrService.ts        # Tesseract.js OCR
│   ├── phashService.ts      # Perceptual hash
│   └── uploadService.ts     # API client
├── functions/          # Cloudflare Pages Functions (serverless API)
│   ├── _utils.ts            # Shared utilities (GitHub client, CORS)
│   └── api/v1/images/       # Image API endpoints
│       ├── index.ts         # GET list, POST upload
│       ├── [id].ts          # GET metadata
│       └── [id]/[type].ts   # GET original/thumb
├── schemas/            # JSON Schema definitions
│   └── image-meta.schema.json
├── types.ts            # TypeScript interfaces
├── constants.ts        # Static data and constants
├── App.tsx             # Main application component
├── index.tsx           # React entry point
├── rsbuild.config.ts   # Rsbuild configuration
├── tsconfig.json       # TypeScript configuration
└── wrangler.toml       # Cloudflare Pages config
```

## Architecture

### Image Upload Flow

1. **Browser Processing** (all CPU-intensive work done client-side):
   - SHA-256 hash for deduplication
   - Thumbnail generation (1024px, WebP)
   - EXIF extraction + GPS removal
   - OCR (Tesseract.js with eng+chi_sim)
   - Dominant color extraction
   - Blur detection (variance of Laplacian)
   - Perceptual hash (blockhash)

2. **Pages Functions** (serverless API):
   - CORS handling
   - GitHub API writes (serialized with 1.1s intervals)
   - Redirect to GitHub raw content for image serving

3. **GitHub Storage**:
   - Path structure: `objects/{p1}/{p2}/sha256_{hash}/{original,thumb,meta.json}`
   - Max file size: 25MB
   - Private repository for privacy

### API Endpoints

```
POST /api/v1/images           # Upload image + thumbnail + metadata
GET  /api/v1/images           # List images (paginated)
GET  /api/v1/images/:id       # Get metadata JSON
GET  /api/v1/images/:id/thumb # Redirect to thumbnail
GET  /api/v1/images/:id/original # Redirect to original
```

## Code Style Guidelines

### TypeScript

- **Interfaces vs Types**: Use `interface` for object shapes, `type` for unions/intersections
- **Naming**:
  - Interfaces: `UpperCamelCase` with `Props` suffix for component props
  - Variables/functions: `lowerCamelCase`
  - Constants: `UPPER_SNAKE_CASE`
- **Type annotations**: Declare types explicitly for function parameters and return types
- **Avoid**: `any`, `@ts-ignore`, non-null assertions (`!`)

### React

- Use function components with `React.FC<Props>` typing
- Component filenames: `kebab-case.tsx`
- JSX component names: `UpperCamelCase`
- Always specify `key` prop when mapping (use unique IDs, not array indices)

### Styling

- Use Tailwind CSS utility classes
- Dark theme with colors: `#0f0f0f` (background), `#1a1a1a` (cards), `#2a2a2a` (elevated)

## Environment Variables

### Frontend (`.env.local`)

- `RSBUILD_API_URL` - API base URL (optional, defaults to same origin)

### Pages Functions (`.dev.vars` for local, Cloudflare Dashboard for production)

- `GITHUB_TOKEN` - GitHub PAT with `repo` scope
- `ALLOW_ORIGIN` - CORS allowed origin (e.g., `http://localhost:3000`)

Variables defined in `wrangler.toml`:
- `GH_OWNER` - GitHub owner (Maidang1)
- `GH_REPO` - GitHub repository (photos)
- `GH_BRANCH` - Git branch (main)

## Deployment

### Cloudflare Pages

1. **Connect repository** in Cloudflare Dashboard
   - Build command: `pnpm run build`
   - Output directory: `dist`

2. **Set secrets** in Cloudflare Dashboard → Pages → Settings → Environment variables:
   - `GITHUB_TOKEN`
   - `ALLOW_ORIGIN`

3. **Deploy**: `pnpm run deploy` (after `pnpm run build`)

## Key Dependencies

### Frontend
- **react**: UI framework
- **lucide-react**: Icon library
- **exifr**: EXIF/XMP/IPTC parsing
- **tesseract.js**: Browser OCR
- **blockhash**: Perceptual image hashing
- **tailwindcss**: Styling
- **rsbuild**: Build tool

### Pages Functions
- **@cloudflare/workers-types**: TypeScript types

## Notes

- Pages Functions LSP errors in IDE are expected (Cloudflare-specific types)
- GPS data is automatically removed from EXIF for privacy
- OCR runs in WebWorker to avoid blocking UI
- GitHub writes are serialized to avoid rate limits
