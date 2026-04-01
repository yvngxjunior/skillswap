-- SkillSwap MVP — Full schema (Sprint 1 + Sprint 2)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- USERS
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
-- REFRESH TOKENS
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
-- SKILLS REFERENTIAL
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) UNIQUE NOT NULL,
  category   VARCHAR(100) NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_name     ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);

-- ─────────────────────────────────────────────
-- USER SKILLS
-- ─────────────────────────────────────────────
CREATE TYPE IF NOT EXISTS skill_type   AS ENUM ('offered', 'wanted');
CREATE TYPE IF NOT EXISTS skill_level  AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

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
-- AVAILABILITIES
-- ─────────────────────────────────────────────
-- day_of_week: 0=Sunday ... 6=Saturday
CREATE TABLE IF NOT EXISTS availabilities (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME    NOT NULL,
  end_time     TIME    NOT NULL,
  CONSTRAINT chk_time_order CHECK (end_time > start_time),
  UNIQUE(user_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_availabilities_user_id ON availabilities(user_id);

-- ─────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
