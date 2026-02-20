# @lumina/web

Lumina web app (React + Rsbuild) with Cloudflare Pages Functions API.

## Dev

```bash
pnpm --filter @lumina/web dev
```

## Full local mode

```bash
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm --filter @lumina/web dev:full
```

Required in `apps/web/.dev.vars`:

- `GITHUB_TOKEN`
- `ALLOW_ORIGIN`
- `UPLOAD_TOKEN`
- `SHARE_SIGNING_SECRET` (recommended)

`apps/web/wrangler.toml` vars:

- `GH_OWNER`
- `GH_REPO`
- `GH_BRANCH`
