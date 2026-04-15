-- Migration 009: badges catalogue + user_badges junction table

-- Extend notification_type enum safely
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_badge';
EXCEPTION WHEN others THEN NULL; END $$;

-- Reference table: all available badges
CREATE TABLE IF NOT EXISTS badges (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(64)  NOT NULL UNIQUE,
  label       VARCHAR(128) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  icon        VARCHAR(32)  NOT NULL DEFAULT '🏅',
  threshold   INT          NOT NULL CHECK (threshold > 0),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed the 3 MVP badges (idempotent)
INSERT INTO badges (slug, label, description, icon, threshold) VALUES
  ('first_exchange',  'Premier échange',  'Réaliser son premier échange.',          '🥇', 1),
  ('five_exchanges',  '5 échanges',        'Réaliser 5 échanges au total.',          '🥈', 5),
  ('ten_exchanges',   '10 échanges',       'Réaliser 10 échanges au total.',         '🥉', 10)
ON CONFLICT (slug) DO NOTHING;

-- Junction table: badges earned by users
CREATE TABLE IF NOT EXISTS user_badges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id    UUID        NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_badge UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id  ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);
