# AI Bilingual Job Search Analytics Platform

A local-first AI job application management platform for Chinese-speaking international students applying for English-speaking roles in Australia, Singapore, and China.

The app helps students paste job descriptions, generate evidence-based AI analysis, decide which jobs are worth applying to, understand skill gaps, tailor resumes, and manage applications in a spreadsheet-style tracker.

## Target Users

- Chinese-speaking international students applying for analyst, consulting, product operations, risk, FinTech, and business roles
- Early-career candidates who need to compare job fit and tailor English resumes
- Portfolio reviewers who want to evaluate a practical local-first AI product workflow

## Key Features

- Spreadsheet-style job tracker with search, filters, sorting, clickable rows, row hover states, and status updates
- Multi-select jobs, batch status update, batch delete with confirmation, and CSV export
- Filters for high-match jobs, jobs needing action, and approaching deadlines
- Add Job workflow for source URL, pasted JD text, deadline, channel, contacts, interview date, notes, and follow-up notes
- Editable candidate profile saved locally and used for AI match scoring
- Resume upload on the Profile page to generate a candidate profile draft from `.docx` or text-based `.pdf` resumes
- Evidence-based AI analysis with match score breakdown, JD evidence, candidate gaps, confidence levels, red flags, and positive signals
- Recommended next action: apply now, tailor resume first, save for later, skip, or improve skills before applying
- Skill gap analysis with matched skills, missing skills, required tools, resume keywords, learning actions, and missing-skill priority
- Decision-focused job detail page with status timeline, notes, requirements, responsibilities, and collapsed raw JD text
- Dashboard analytics for application funnel, role types, average match by role, top skills, missing skills, tools, regions, and high-priority jobs
- English / Simplified Chinese UI toggle with static translation dictionaries
- Demo sample data for review without calling the AI API
- Server-only AI provider abstraction for OpenAI-compatible providers including OpenAI and DeepSeek

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Local storage persistence
- OpenAI-compatible chat completions API abstraction
- Resume text extraction with Mammoth for Word `.docx` files and pdf-parse for text-based PDFs
- Lightweight custom table and dashboard visual blocks
- Windows local-app launcher scripts for one-click local use

## AI Analysis Workflow

1. The user pastes a job description on the Add Job page.
2. The frontend loads the saved candidate profile from local storage.
3. The app sends the JD, source URL reference, and candidate profile to `/api/analyze-job`.
4. The server-side provider calls the configured AI model and asks for JSON-only output.
5. The response is normalized for backward compatibility with older saved jobs.
6. The job record is saved locally and opened on the detail page.

The API key is only read on the server side. It is never exposed to browser code.

## Resume-to-Profile Workflow

1. The user opens the Profile page and uploads a `.docx` resume or a text-based `.pdf`.
2. The server extracts plain text from the resume.
3. The app sends the extracted text and current saved profile to `/api/analyze-resume`.
4. The AI returns a candidate profile draft, bilingual summaries, extracted strengths, unclear information, and confidence level.
5. The user reviews the draft and clicks `Apply to Profile` only if they want to save it locally.

The original resume file is not saved by the app. Only the user-approved candidate profile is persisted in local storage. V1 does not support scanned PDFs or OCR.

## Candidate Profile Personalization

The Profile page stores local candidate preferences used in AI scoring:

- Target regions
- Target roles
- Education background
- Degree direction
- Technical skills
- Business skills
- Tools
- Work experience
- Work rights / visa status
- Preferred industries
- Preferred language
- Career goals

Users can also generate a draft profile from an uploaded resume and then manually edit it before saving.

Default profile:

- Chinese-speaking international student
- Bachelor background in Statistics
- Master direction in Business Analytics and FinTech
- Target regions: Australia, Singapore, China
- Target roles: Data Analyst, Business Analyst, Product Operations, Risk Strategy, Consulting, FinTech
- Skills: SQL, Python, Excel, Power BI, data analysis, report writing, questionnaire analysis, consulting research
- Experience: FMCG quantitative research, consulting project work, transcript cleaning, insight memo writing
- Work rights: international student

## Match Scoring Logic

The AI returns a 0-100 match score and six dimensions:

- Education fit
- Technical skills fit
- Business / communication fit
- Experience fit
- Career direction fit
- Location / international student suitability

Each dimension includes a score, explanation, evidence from the JD, candidate gap, and confidence level.

The score should increase when a role fits analytics, product operations, risk, consulting, FinTech, or early-career business roles. It should decrease when the JD requires many years of experience, missing work rights, unclear sponsorship fit, or skills far outside the profile.

## Cost Control Notes

- AI output is requested as concise JSON only.
- Resume text is shortened before AI analysis if it is very long.
- The app caches analyses in local storage using the normalized JD and candidate profile.
- Re-analyzing the same unchanged JD with the same profile reuses cached analysis.
- The source URL is saved only as a reference; the app does not scrape protected job boards.
- Future server-side caching can be added in `/api/analyze-job`.

## Demo Mode and Sample Data

The app can be reviewed without an API key:

1. Open the tracker.
2. Click `Load sample data`.
3. Review the dashboard, table, detail page, profile page, edit flow, filters, batch actions, export, and timeline.

You can also test the Add Job workflow with:

```text
samples/sample-jd.txt
```

## Run Locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Windows Local Launcher

For day-to-day local use on Windows, double-click:

```text
open-job-tracker-windows.vbs
```

This starts the local Next.js server quietly in the background and opens [http://127.0.0.1:3000](http://127.0.0.1:3000).

When finished, double-click:

```text
stop-job-tracker-windows.vbs
```

Launcher logs are stored in `.localappdata`, which is ignored by Git.

## Environment Variables

Create `.env.local` in the project root. Never commit this file.

OpenAI example:

```bash
AI_PROVIDER=openai
AI_MODEL=gpt-5-mini
OPENAI_API_KEY=your_openai_api_key_here
```

DeepSeek example:

```bash
AI_PROVIDER=deepseek
AI_MODEL=deepseek-chat
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

## Useful Commands

```bash
pnpm lint
pnpm build
```

## Product Constraints

- No login
- No payment
- No browser extension
- No scraping LinkedIn, Seek, Indeed, or other protected job boards
- Source URLs are saved only as references
- Uploaded resume files are used for one-time server-side text extraction and are not stored by the app
- Persistence is local-first for this MVP
- API keys must stay in `.env.local` and server-side environment variables only

## Roadmap

- CSV import and backup restore
- Resume version tracking per job
- OCR support for scanned PDF resumes
- Calendar reminders for deadlines, follow-ups, and interviews
- Optional SQLite or Supabase persistence
- More robust AI JSON validation with schema tooling
- Deployment-ready demo mode with seeded non-sensitive data
- Resume tailoring workspace and cover letter draft helper
