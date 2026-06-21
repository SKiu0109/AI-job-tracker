# AI Bilingual Job Application Tracker

A local-first Next.js app for Chinese-speaking international students to paste job descriptions, generate bilingual AI analysis, and manage applications in a spreadsheet-style tracker.

## Features

- Job tracker table with search, filters, match-score sorting, and inline status updates
- Add Job page for source URL, pasted JD text, notes, and AI analysis
- Job detail page with English and Simplified Chinese AI fields
- English / 中文 UI toggle
- Browser local storage persistence for V1
- Server-only AI provider abstraction with OpenAI as the first provider
- Client-side analysis cache to avoid repeated calls for the same unchanged JD

## Requirements

- Node.js 20+
- pnpm
- OpenAI API key

## Environment Variables

Create `.env.local` in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER=openai
AI_MODEL=gpt-5-mini
```

`AI_PROVIDER` defaults to `openai`. `AI_MODEL` defaults to `gpt-5-mini` and can be replaced with another compatible model.

## Run Locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

On this Windows Codex desktop workspace, you can also run:

```bat
start-dev-windows.cmd
```

Keep that terminal window open while using the app.

## Test With a Sample JD

Use `samples/sample-jd.txt` as a quick pasted job description.

## Useful Commands

```bash
pnpm lint
pnpm build
```

## Notes

- No login, payment, browser extension, or job-board scraping is included in V1.
- Source URL is stored only as a reference.
- Jobs are stored in browser local storage, so data stays on the current device/browser.
- API keys are only read in the server API route and are not exposed to frontend code.
