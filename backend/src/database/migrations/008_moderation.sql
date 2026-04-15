-- Migration 008: reports table + soft-delete columns

-- ── Enums ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE report_target_type AS ENUM ('user', 'exchange', 'message');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_reason AS ENUM ('spam', 'inappropriate', 'harassment', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── reports ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type report_target_type NOT NULL,
  target_id   UUID NOT NULL,
  reason      report_reason NOT NULL,
  comment     VARCHAR(300),
  status      report_status NOT NULL DEFAULT 'pending',
  admin_note  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status      ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target_type ON reports(target_type);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
-- prevent duplicate reports from same user on same target
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique
  ON reports(reporter_id, target_type, target_id);

-- ── soft-delete columns ────────────────────────────────────────────────
ALTER TABLE users      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE exchanges  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE messages   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial indexes for fast "is alive" look-ups
CREATE INDEX IF NOT EXISTS idx_users_not_deleted     ON users(id)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exchanges_not_deleted ON exchanges(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_not_deleted  ON messages(id)  WHERE deleted_at IS NULL;
