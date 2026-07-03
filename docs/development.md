# Development

## Requirements

- Node.js 22 or newer
- pnpm 11.x

## Common Commands

```bash
pnpm install
pnpm dev:local
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm run ci
pnpm run clean
```

`pnpm run ci` runs the same core checks expected in GitHub Actions. Do not use `pnpm ci` for this repo.

## Environment

Start from `.env.example` and create `.env.local`.

Important server-side values include:

- `AI_PROVIDER`
- `OPENAI_API_KEY` or `DEEPSEEK_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Public Supabase client values include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never expose `SUPABASE_SERVICE_ROLE_KEY` through `NEXT_PUBLIC_` variables.

## macOS Helpers

The shell helpers mirror the Windows scripts:

```bash
bash scripts/start-local-app.sh
bash scripts/stop-local-app.sh
```

The start helper writes the local server PID to `.next/local-app.pid`.

## Workspace Hygiene

Use the cleanup script after local builds, browser audits, generated-image experiments, or packaging work:

```bash
pnpm run clean -- --dry-run
pnpm run clean
```

The script removes regenerated local artifacts such as `.next`, `.pnpm-store`, `.playwright-cli`, `audit-output`, `generated-images`, `output`, `outputs`, coverage and Playwright reports, logs, `.DS_Store`, and `*.tsbuildinfo`.

To also remove installed dependencies, run:

```bash
pnpm run clean:deps
pnpm install
```
