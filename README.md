# Lumina Monorepo

Lumina is now organized as a pnpm + Turborepo monorepo.

## Workspace Layout

- `apps/web`: React frontend + Cloudflare Pages Functions API
- `packages/contracts`: shared metadata/types/path helpers
- `packages/github-storage`: GitHub object/index storage client
- `packages/upload-core`: upload preprocessing pipeline (Node + browser entry)
- `packages/cli`: `lumina-upload` batch upload CLI

## Quick Start

```bash
pnpm install
pnpm dev:web
```

## Scripts

- `pnpm build`: build all packages/apps via turbo
- `pnpm typecheck`: typecheck all workspaces
- `pnpm dev:web`: run web dev server
- `pnpm dev:full`: run web full mode (build watch + pages functions)
- `pnpm cli:build`: build CLI package

## CLI

After build/publish, use:

```bash
lumina-upload --owner <owner> --repo <repo> --token <token> upload <dir>
```

Environment variable alternatives:

- `LUMINA_GITHUB_TOKEN`
- `LUMINA_GH_OWNER`
- `LUMINA_GH_REPO`
- `LUMINA_GH_BRANCH`
