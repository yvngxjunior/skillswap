-- Migration 005: in-app notification system
-- Run: psql $DATABASE_URL -f 005_notifications.sql

-- ── Notification type enum ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'exchange_requested',
    'exchange_accepted',
    'exchange_cancelled',
    'new_message',
    'new_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Notifications table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  payload    JSONB             NOT NULL DEFAULT '{}',
  read_at    TIMESTAMPTZ       DEFAULT NULL,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON notifications(user_id, created_at DESC);

-- ── Expo push token on users ──────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT DEFAULT NULL;
