-- Migration 001: extend sprints + founders, add google_tokens
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS COLUMN where possible).

-- ───── SPRINTS new columns ────────────────────────────────────────────────
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS total_duration TEXT;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS sprint_host TEXT;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS co_host TEXT;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS billed_to TEXT;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS bill_number TEXT;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS price NUMERIC(12,2);
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS week INTEGER;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS month INTEGER;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS cy_year INTEGER;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS fy_year INTEGER;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS quarter TEXT;

CREATE INDEX IF NOT EXISTS sprints_scheduled_date_idx ON sprints (scheduled_date DESC);
CREATE INDEX IF NOT EXISTS sprints_consultant_idx     ON sprints (consultant_name);
CREATE INDEX IF NOT EXISTS sprints_host_idx           ON sprints (sprint_host);

-- ───── FOUNDERS new columns ───────────────────────────────────────────────
ALTER TABLE founders ADD COLUMN IF NOT EXISTS contact TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS founder_2_name TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS founder_2_email TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS founder_2_contact TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS goal_setting TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS revenue_last_12m TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS revenue_last_month_mrr TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS team_size INTEGER;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS key_strength TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS gap TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS concept_and_sessions TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS mentor_recommendation TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS market_access TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS ideal_customer_list TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS timeline_for_market_access TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS observations_ts TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS recommendation_for_vc TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS previous_fundraise_inr NUMERIC(18,2);
ALTER TABLE founders ADD COLUMN IF NOT EXISTS previous_fundraise_orgs TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS current_burn TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS fund_ask_cr NUMERIC(12,2);
ALTER TABLE founders ADD COLUMN IF NOT EXISTS fundraise_commitments TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS fundraise_notes TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS fathom_link TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS current_problem TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS suggested_next_step TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS next_five_sprints TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS case_study_worthy BOOLEAN;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS case_study_theme TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS training_worthy BOOLEAN;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS training_theme TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS t_sprint_intervention TEXT;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS tasks TEXT;

CREATE INDEX IF NOT EXISTS founders_incubator_idx ON founders (incubator_id);

-- ───── GOOGLE TOKENS table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS google_tokens (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL UNIQUE,
  access_token    TEXT,
  refresh_token   TEXT,
  scope           TEXT,
  token_type      TEXT,
  expiry_date     TIMESTAMP WITH TIME ZONE,
  has_calendar    TEXT,
  has_gmail       TEXT,
  has_drive       TEXT,
  has_sheets      TEXT,
  google_email    TEXT,
  google_profile  JSONB,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ───── Type constraints / cleanup ─────────────────────────────────────────
-- Make sure incubator.type only allows our three approved categories going forward.
-- (Won't fail on existing rows; we'll handle them in the route layer.)
