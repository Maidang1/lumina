# @luminafe/cli

Batch upload photos from local disk to GitHub object storage used by Lumina.

## Install

```bash
npm i -g @luminafe/cli
```

## Commands

- `lumina-upload upload <input...>`
- `lumina-upload resume`
- `lumina-upload validate <input...>`

## Example

```bash
lumina-upload \
  --owner your-owner \
  --repo your-repo \
  --token ghp_xxx \
  --branch main \
  --concurrency 4 \
  upload ./photos
```

## Manifest

Default manifest file: `.lumina-upload-manifest.json`.
Use `resume` to continue unfinished uploads.

## Maintainer Release

```bash
pnpm run cli:build
pnpm run cli:pack
pnpm run cli:publish
```
