-- SkillSwap MVP — Complete schema (Sprints 1–4)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255)  UNIQUE NOT NULL,
  password_hash  TEXT          NOT NULL,
  pseudo         VARCHAR(50)   UNIQUE NOT NULL,
  bio            TEXT          DEFAULT '',
  birth_date     DATE          NOT NULL,
  photo_url      TEXT          DEFAULT NULL,
  credit_balance INTEGER       NOT NULL DEFAULT 2,
  exchange_count INTEGER       NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2)  DEFAULT NULL,
  cgu_accepted   BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_pseudo ON users(pseudo);

-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) UNIQUE NOT NULL,
  category   VARCHAR(100) NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skills_name     ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);

-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE skill_type  AS ENUM ('offered', 'wanted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_skills (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id   UUID        NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  type       skill_type  NOT NULL,
  level      skill_level NOT NULL DEFAULT 'beginner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, skill_id, type)
);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id  ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON user_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_type     ON user_skills(type);

-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS availabilities (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME     NOT NULL,
  end_time     TIME     NOT NULL,
  CONSTRAINT chk_time_order CHECK (end_time > start_time),
  UNIQUE(user_id, day_of_week, start_time)
);
CREATE INDEX IF NOT EXISTS idx_availabilities_user_id ON availabilities(user_id);

-- ─────────────────────────────────────────────
-- EXCHANGES
-- status: pending → accepted → completed | cancelled
-- confirmed_by_requester / confirmed_by_partner: both must be true to complete
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE exchange_status AS ENUM ('pending', 'accepted', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS exchanges (
  id                       UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id             UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id               UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id                 UUID            NOT NULL REFERENCES skills(id),
  duration_minutes         INTEGER         NOT NULL DEFAULT 60,
  desired_date             TIMESTAMPTZ     DEFAULT NULL,
  status                   exchange_status NOT NULL DEFAULT 'pending',
  confirmed_by_requester   BOOLEAN         NOT NULL DEFAULT FALSE,
  confirmed_by_partner     BOOLEAN         NOT NULL DEFAULT FALSE,
  message                  TEXT            DEFAULT '',
  compatibility_score      SMALLINT        DEFAULT NULL,
  created_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_no_self_exchange CHECK (requester_id != partner_id)
);
CREATE INDEX IF NOT EXISTS idx_exchanges_requester ON exchanges(requester_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_partner   ON exchanges(partner_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_status    ON exchanges(status);
CREATE INDEX IF NOT EXISTS idx_exchanges_composite ON exchanges(requester_id, partner_id, status);

-- ─────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID        NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  read_at     TIMESTAMPTZ DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_exchange_id ON messages(exchange_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id   ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at  ON messages(exchange_id, created_at);

-- ─────────────────────────────────────────────
-- REVIEWS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id  UUID    NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  reviewer_id  UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id  UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  punctuality  SMALLINT NOT NULL CHECK (punctuality BETWEEN 1 AND 5),
  pedagogy     SMALLINT NOT NULL CHECK (pedagogy    BETWEEN 1 AND 5),
  respect      SMALLINT NOT NULL CHECK (respect     BETWEEN 1 AND 5),
  overall      SMALLINT NOT NULL CHECK (overall     BETWEEN 1 AND 5),
  comment      TEXT     DEFAULT '' CHECK (char_length(comment) <= 300),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exchange_id, reviewer_id)  -- one review per participant per exchange
);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id  ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_exchange_id  ON reviews(exchange_id);

-- ─────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at     ON users;
CREATE TRIGGER trg_users_updated_at     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_exchanges_updated_at ON exchanges;
CREATE TRIGGER trg_exchanges_updated_at BEFORE UPDATE ON exchanges FOR EACH ROW EXECUTE FUNCTION set_updated_at();
