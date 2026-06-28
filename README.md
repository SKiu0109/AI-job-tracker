# AI Bilingual Job Tracker

A local-first bilingual job application tracker for Chinese-speaking students and early-career candidates applying to English-speaking roles.

This open-source repository is intended as the local deployment / portfolio version. It focuses on the core workflow: paste a job description, review AI-assisted fit analysis when an API key is configured, and manage applications in a spreadsheet-style workspace. Hosted production features are only mentioned briefly because they are mainly used by the online deployment.

Online demo: [https://ai-bilingual-job-tracker.vercel.app](https://ai-bilingual-job-tracker.vercel.app)

## What You Can Run Locally

- Landing page with demo entry
- Workspace tracker with search, filters, sorting, status updates, batch actions, and CSV export
- Add Job flow for pasted job descriptions and optional application notes
- Candidate profile editor saved in browser local storage
- Resume-to-profile draft generation from `.docx` or text-based `.pdf` files
- Job detail pages with score breakdown, evidence, gaps, notes, and timeline
- Dashboard analytics for funnel, role types, match scores, skills, missing skills, tools, and regions
- English / Simplified Chinese UI toggle
- Demo sample data when no AI key is configured
- Windows helper scripts for starting/stopping the local app

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Browser local storage for local jobs/profile/cache
- Server-only OpenAI-compatible AI provider abstraction
- Mammoth for `.docx` text extraction
- `pdf-parse` for text-based PDF extraction

## Run Locally

Install dependencies:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

On Windows, you can also double-click:

```text
open-job-tracker-windows.vbs
```

When finished:

```text
stop-job-tracker-windows.vbs
```

## Demo Mode

The app runs without an AI API key. In that mode, you can load sample jobs and explore the workspace, dashboard, job detail pages, profile page, edit flow, filters, batch actions, and CSV export.

Sample JD:

```text
samples/sample-jd.txt
```

## Optional AI Setup

Create `.env.local` from `.env.example`.

OpenAI-compatible example:

```bash
AI_PROVIDER=openai
AI_MODEL=gpt-5-mini
OPENAI_API_KEY=your_openai_api_key_here
```

DeepSeek-compatible example:

```bash
AI_PROVIDER=deepseek
AI_MODEL=deepseek-chat
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

API keys are read only on the server side. Do not prefix provider keys with `NEXT_PUBLIC_`.

## Local Data Model

The open-source local workflow is intentionally local-first:

- Jobs are saved in browser local storage.
- Candidate profile data is saved in browser local storage.
- Client analysis cache is saved in browser local storage.
- Uploaded resume files are used for one-time text extraction and are not stored by the app.
- Source URLs are saved only as references; the app does not scrape LinkedIn, Seek, Indeed, or other protected job boards.

## Hosted Version Notes

Some files support the hosted development/deployment version, including optional Supabase auth, cloud sync, guest/user credits, redemption codes, feedback capture, and product-event tracking.

Hosted demo: [https://ai-bilingual-job-tracker.vercel.app](https://ai-bilingual-job-tracker.vercel.app)

For local open-source use, these services are optional. If you want to experiment with the hosted path, start from:

- `supabase/validation-mvp.sql`
- `supabase/next-phase-auth-cloud.sql`
- `supabase/redemption-codes.sql`
- `supabase/fix-security-definer-execute-grants.sql`
- `.env.example`

Production deployments must use persistent storage for credits and authenticated user data. In-memory fallback is suitable for local development and demos only.

## Useful Commands

```bash
pnpm lint
pnpm build
pnpm audit --prod
```

## Project Structure

```text
src/app                 Next.js pages and API routes
src/components          UI and feature components
src/lib                 AI, auth, storage, i18n, server utilities
src/types               Shared TypeScript types
samples                 Sample job description
scripts                 Windows local app helpers
supabase                Optional hosted-version SQL
```

## Contributors

See [CONTRIBUTORS.md](CONTRIBUTORS.md).

## License

MIT
