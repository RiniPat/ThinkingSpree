# Sprint Automation Suite

Internal consultant platform for **Thinking Spree** — manage founders, run T-Sprint sessions, sync with Google Workspace, and track engagements across ISB / JU / Demo programs.

## Deploy

👉 **[DEPLOY_TO_RENDER.md](./DEPLOY_TO_RENDER.md)** — full step-by-step guide. Free tier on Render + Neon Postgres. Total cost: $0/month.

👉 **[GOOGLE_INTEGRATION_SETUP.md](./GOOGLE_INTEGRATION_SETUP.md)** — wiring up Google Calendar, Gmail, Drive, and Sheets.

## What it does

- **Dashboard** — consultant-scoped view of your assigned sprints, today's calendar (pulled live from Google Calendar when connected)
- **Sprint Tracking** — table + card views with Excel-parity filters (Industry, Stage, Program, Partner, Host, Co-Host, Session Type, Payment, Year, Quarter, Month, date range), sortable columns, search
- **Summary Sheet** — ISB / JU / Demo program views with full founder details (Goal Setting, Key Strength, Gap, Market Access, Fund Ask, Case Study theme, etc.)
- **Sprint Detail** — per-sprint AI-generated pre/post emails with human review before send via Gmail
- **Google Integrations** — Calendar (live), Gmail (send), Drive (link), Sheets (sync) via per-user OAuth
- **Settings** — connection test page that runs a cheap read against each Google service to verify scopes

## Stack

- **Frontend** — React 19 + Vite 7 + Wouter + TanStack Query + Tailwind + shadcn/ui
- **Backend** — Express 5 + Drizzle ORM + Postgres-backed sessions (`connect-pg-simple`)
- **Auth** — Email/password with bcryptjs, restricted to `@thinkingspree.com` domain
- **DB** — Postgres (Neon free tier)
- **API contract** — OpenAPI 3.1 → Orval-generated TanStack Query hooks
- **Validation** — Zod (`zod/v4`)

## Local development

```bash
# Prerequisites: Node 22+, pnpm 10+
corepack enable

# Install
pnpm install

# Set up env
cp .env.example .env  # then fill in DATABASE_URL, SESSION_SECRET

# Apply migrations
psql "$DATABASE_URL" -f lib/db/migrations/001_extend_schema.sql

# Run both API + frontend (two terminals)
pnpm --filter @workspace/api-server run dev    # http://localhost:5000
pnpm --filter @workspace/thinking-spree run dev # http://localhost:5173

# Or build & run as one combined server (like production)
pnpm run render:build
pnpm run render:start
```

## Repo layout

```
artifacts/
  api-server/        Express API
  thinking-spree/    Vite + React frontend
lib/
  api-spec/          OpenAPI 3.1 source of truth + Orval config
  api-client-react/  Generated TanStack Query hooks
  api-zod/           Generated Zod schemas
  db/                Drizzle schema + migrations
scripts/
  src/seed-summary-sheets.ts   Import ISB/JU/Tracking Excel files
  src/seed-dry-run.ts          Parse-only validator (no DB writes)
```

## License

Proprietary — internal use only.
