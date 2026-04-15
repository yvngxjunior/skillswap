-- Migration 006: notifications table + expo push token support

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'exchange_request',
    'exchange_accepted',
    'exchange_cancelled',
    'exchange_completed',
    'new_message',
    'new_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  payload    JSONB             NOT NULL DEFAULT '{}',
  read_at    TIMESTAMPTZ       DEFAULT NULL,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread     ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Optional Expo push token stored per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT DEFAULT NULL;
