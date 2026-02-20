# LOGOS

Research assistant for analyzing papers, identifying methodological gaps, and proposing validation experiments. Built with React, TypeScript, and Node.

## Features

- **Paper analysis** — Upload PDFs for structured methodology summaries and insights
- **Gap identification** — Surfaces assumptions and methodological limitations
- **Experiment design** — Suggests validation experiments and Python-style protocols
- **Session history** — Persisted in Supabase or local storage
- **Custom models** — Gemini or any OpenAI-compatible API via proxy
- **Reasoning view** — Graph and scorecard for reproducibility and citation integrity

## Tech stack

| Layer      | Stack |
|-----------|--------|
| Frontend  | React 19, Vite, TypeScript, Tailwind CSS |
| Backend   | Express (Node.js) |
| AI        | Google Gemini API or custom endpoint |
| Auth/Data | Supabase (optional) |

## Prerequisites

- Node.js 18+
- npm 9+

## Getting started

```bash
git clone https://github.com/YOUR_ORG/logos.git
cd logos
npm install
cp .env.example .env.local
# Edit .env.local with your keys
```

Configure `.env.local` (see [Environment variables](#environment-variables)), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes* | Google AI API key (server-side). Required for analysis. |
| `VITE_SUPABASE_URL` | No | Supabase project URL (client) |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anon key (client) |
| `SUPABASE_URL` | No | Same as `VITE_SUPABASE_URL` (server) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key (server) |
| `ALLOWED_CUSTOM_AI_BASE_URLS` | No | Comma-separated URLs for custom AI proxy |
| `APP_ORIGIN` | No | App origin for OAuth (e.g. `https://app.example.com`) |
| `VITE_API_URL` | No | API base URL in production when frontend and API differ (e.g. Netlify + Render) |

\* Without Supabase, only `GEMINI_API_KEY` is required; sessions use local storage.

**Supabase:** To enable auth and cloud session storage, set all four Supabase variables and run `supabase/migrations/001_initial.sql` in the Supabase SQL Editor. For Google sign-in, configure the Google provider and redirect URLs in the Supabase dashboard.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Vite HMR) |
| `npm run build` | Production build (output: `dist/`) |
| `npm run start` | Serve production build (run after `build`) |
| `npm run lint` | TypeScript type-check |

## Deployment

### Netlify (frontend)

1. Connect the repo to Netlify.
2. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. In **Site settings → Environment variables**, set all `VITE_*` and any other vars the build needs (e.g. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. If the API runs elsewhere (e.g. Render), set `VITE_API_URL` to that API base URL (e.g. `https://your-api.onrender.com`).

The frontend will call the API at `VITE_API_URL` when set; leave it unset only if the same server serves both the app and the API.

### Backend (API)

The Express server in `server.ts` must run on a Node host (e.g. [Render](https://render.com), [Railway](https://railway.app)). Deploy the repo, set the same env vars (except `VITE_*`), and use:

- **Start command:** `npm run build && npm run start`  
  or `npx tsx server.ts` if the host runs TypeScript.

Point Netlify’s `VITE_API_URL` to this backend URL so the frontend uses the production API.

## Project structure

```
├── components/     React UI components
├── config/         Client env (e.g. API base URL)
├── services/       API clients (Gemini, Supabase, PDF, custom AI)
├── supabase/       SQL migrations
├── App.tsx         Root component and state
├── server.ts       Express server and API routes
└── vite.config.ts  Vite configuration
```

## License

Proprietary. All rights reserved.
