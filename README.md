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
| API       | Supabase Edge Functions (Gemini) or Express (local) |
| Auth/Data | Supabase |

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
| `VITE_SUPABASE_URL` | Yes* | Supabase project URL (client) |
| `VITE_SUPABASE_ANON_KEY` | Yes* | Supabase anon key (client) |
| `GEMINI_API_KEY` | Yes** | For local dev (Express) or set in Supabase Edge Function secrets for production |
| `SUPABASE_URL` | No | Same as `VITE_SUPABASE_URL` (only for local Express server) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Only for local Express server |
| `ALLOWED_CUSTOM_AI_BASE_URLS` | No | Only for local Express proxy (optional) |
| `APP_ORIGIN` | No | App origin for OAuth |
| `VITE_API_URL` | No | Only if you run the Express API on a separate host |

\* For production (Netlify + Supabase), only the two `VITE_*` Supabase vars are needed on the frontend.  
\** For **paper analysis**: set `GEMINI_API_KEY` in **Supabase** → Project Settings → Edge Functions → Secrets (see [Deployment](#deployment)).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Vite HMR) |
| `npm run build` | Production build (output: `dist/`) |
| `npm run start` | Serve production build (run after `build`) |
| `npm run lint` | TypeScript type-check |

## Deployment

With **Supabase**, you only deploy the frontend (Netlify) and the Edge Function (Supabase). No separate Node server (e.g. Render) is required.

### 1. Supabase: database and Edge Function

1. **Database:** In Supabase → **SQL Editor**, run the contents of `supabase/migrations/001_initial.sql`.
2. **Edge Function (paper analysis):** Deploy the function and set the Gemini key:
   - Install [Supabase CLI](https://supabase.com/docs/guides/cli) and run `supabase login`.
   - Link the project: `supabase link --project-ref YOUR_REF` (ref = e.g. `ubnvmkyevlnqildjooav` from your project URL).
   - Deploy: `supabase functions deploy analyze-paper`.
   - In **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**, add:
     - **Name:** `GEMINI_API_KEY`  
     - **Value:** your Google AI (Gemini) API key
3. **Auth (optional):** For Google sign-in, follow [Google sign-in setup](#google-sign-in-setup) below.

### 2. Netlify (frontend)

1. **Add site:** [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → **GitHub** → choose **logos**.
2. **Build:** Netlify uses `netlify.toml` (build: `npm run build`, publish: `dist`).
3. **Environment variables:** In **Site settings** → **Environment variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL (e.g. `https://xxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. **Deploy.** The app will use Supabase for auth, sessions, and paper analysis (Edge Function). No `VITE_API_URL` or separate backend needed.
5. **If updates don’t appear:** In Netlify → **Deploys**, use **Trigger deploy** → **Clear cache and deploy site**. In the browser, do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) to avoid cached JS.

## Google sign-in setup

To make **Sign in with Google** work with Supabase, configure both Google Cloud and Supabase.

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Open **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
3. If prompted, configure the **OAuth consent screen** (External user type is fine; add your app name and support email).
4. Choose **Web application** as the application type.
5. **Authorized redirect URIs** — add exactly:
   - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`  
   Replace `<YOUR_SUPABASE_PROJECT_REF>` with your project ref (e.g. from `https://ubnvmkyevlnqildjooav.supabase.co` the ref is `ubnvmkyevlnqildjooav`).
6. (Optional) **Authorized JavaScript origins** — add your app origins, e.g.:
   - `http://localhost:5173`
   - `https://your-site.netlify.app`
7. Create the client and copy the **Client ID** and **Client Secret**.

### 2. Supabase Dashboard

1. **Authentication** → **Providers** → **Google** → enable the provider.
2. Paste the **Client ID** and **Client Secret** from Google, then Save.
3. **Authentication** → **URL Configuration**:
   - **Site URL:** Your production app URL (e.g. `https://your-site.netlify.app`) or `http://localhost:5173` for local testing.
   - **Redirect URLs:** Add every URL where users can land after sign-in (Supabase will only redirect to these):
     - `http://localhost:5173` (local dev)
     - `https://your-site.netlify.app` (production)
     - Add any other domains you use (e.g. preview URLs).

After saving, **Sign in with Google** in the app will redirect to Google, then back to your app with the user signed in.

## Project structure

```
├── components/     React UI components
├── config/         Client env (e.g. API base URL)
├── services/       API clients (Gemini, Supabase, PDF, custom AI)
├── supabase/       SQL migrations + Edge Function (analyze-paper)
├── App.tsx         Root component and state
├── server.ts       Express server (local dev only; optional)
└── vite.config.ts  Vite configuration
```

## License

Proprietary. All rights reserved.
