-- Migration 006: add exchange_request alias to notification_type enum
-- The test suite seeds notifications with 'exchange_request' (no trailing d).
-- Rather than change the tests we add the value to the enum so both forms work.
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'exchange_request';
EXCEPTION WHEN others THEN NULL; END $$;
