# Pathwise Architecture

Pathwise is a Next.js App Router application for bilingual job tracking, JD analysis, resume tailoring, follow-up planning, and lightweight product telemetry.

## Application Layers

- `src/app`: Route entrypoints, route-level loading states, error boundaries, and API handlers.
- `src/components`: Reusable UI and domain components.
- `src/lib/storage`: Browser storage and cloud-sync helpers for jobs, candidate profiles, imports, and cache data.
- `src/lib/server`: Server-only persistence, credits, redemption, rate limiting, Supabase configuration, and cache services.
- `src/lib/ai`: AI provider abstraction and prompt builders.
- `src/lib/i18n`: Bilingual UI copy.
- `supabase`: SQL setup and hardening scripts for hosted persistence.

## Data Flow

1. A user adds or imports a job description through the app UI.
2. API routes validate input and call the configured AI provider.
3. Results are normalized into `JobRecord` data and stored locally or synced to Supabase when authentication is available.
4. Credits are charged through server-only services. Guest credits use `guest_credits`; authenticated users use monthly credits plus bonus wallets.
5. Redemption codes are created and redeemed by server routes using `SUPABASE_SERVICE_ROLE_KEY`.

## Persistence Modes

- Local/demo mode uses browser storage plus in-memory or file-backed server fallbacks.
- Hosted mode uses Supabase for auth, cloud jobs, profiles, analysis cache, credits, redemption codes, rate limits, and product events.
- Production deployments should configure persistent Supabase values and avoid relying on in-memory fallbacks.

## Supabase SQL Order

For a fresh hosted setup, apply the SQL files in this order:

1. `supabase/validation-mvp.sql`
2. `supabase/next-phase-auth-cloud.sql`
3. `supabase/redemption-codes.sql`
4. `supabase/production-hardening.sql`
5. `supabase/fix-security-definer-execute-grants.sql`
6. `supabase/fix-rls-no-policy-lints.sql`

After schema changes, run Supabase advisors and smoke-test critical RPCs before deploying.

## Verification

Use the local verification suite before shipping changes:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
