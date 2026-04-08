'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Prefer a full connection-string URL (set in CI via TEST_DATABASE_URL / DATABASE_URL);
// fall back to individual vars for local development.
const connectionString =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({ connectionString })
  : new Pool({
      host:     process.env.TEST_DB_HOST     || process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.TEST_DB_PORT || process.env.DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME     || 'skillswap_test',
      user:     process.env.TEST_DB_USER     || process.env.DB_USER     || 'skillswap_user',
      // Ensure password is always a string — pg's SCRAM auth rejects undefined
      password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || '',
    });

async function setupDatabase() {
  const schema = fs.readFileSync(
    path.resolve(__dirname, '../../database/schema.sql'),
    'utf8'
  );
  await pool.query(schema);
}

async function teardownDatabase() {
  await pool.query(`
    DROP TABLE IF EXISTS reviews         CASCADE;
    DROP TABLE IF EXISTS messages        CASCADE;
    DROP TABLE IF EXISTS exchanges       CASCADE;
    DROP TABLE IF EXISTS availabilities  CASCADE;
    DROP TABLE IF EXISTS user_skills     CASCADE;
    DROP TABLE IF EXISTS skills          CASCADE;
    DROP TABLE IF EXISTS refresh_tokens  CASCADE;
    DROP TABLE IF EXISTS users           CASCADE;
    DROP TYPE  IF EXISTS exchange_status CASCADE;
    DROP TYPE  IF EXISTS skill_level     CASCADE;
    DROP TYPE  IF EXISTS skill_type      CASCADE;
  `);
  await pool.end();
}

async function clearTables() {
  await pool.query(
    'TRUNCATE reviews, messages, exchanges, availabilities, user_skills, skills, refresh_tokens, users RESTART IDENTITY CASCADE'
  );
}

module.exports = { pool, setupDatabase, teardownDatabase, clearTables };
