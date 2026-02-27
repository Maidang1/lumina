# @luminafe/web

Lumina web app (React + Rsbuild) with Cloudflare Pages Functions API.

## Dev

```bash
pnpm --filter @luminafe/web dev
```

## Full local mode

```bash
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm --filter @luminafe/web dev:full
```

Required in `apps/web/.dev.vars`:

- `GITHUB_TOKEN`
- `ALLOW_ORIGIN`

`apps/web/wrangler.toml` vars:

- `GH_OWNER`
- `GH_REPO`
- `GH_BRANCH`

Optional frontend vars in `.env.local` / `.env`:

- `RSBUILD_GH_OWNER` (used for direct jsDelivr asset URLs)
- `RSBUILD_GH_REPO`
- `RSBUILD_GH_BRANCH`
