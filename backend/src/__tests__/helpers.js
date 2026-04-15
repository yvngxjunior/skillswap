'use strict';

const request = require('supertest');
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');
const app  = require('../app');

/** Run schema.sql + all migrations against the test DB. Idempotent. */
async function applyMigrations() {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) return;

  const pool = new Pool({ connectionString });

  const schemaPath = path.resolve(__dirname, '../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    await pool.query(fs.readFileSync(schemaPath, 'utf8'));
  }

  const migrationsDir = path.resolve(__dirname, '../database/migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      await pool.query(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }
  }

  await pool.end();
}

/**
 * Run schema + migrations once per test-worker process before any suite.
 * Ensures migration-added columns (e.g. `role`) exist in this worker's
 * DB connection — globalSetup runs in a different Node context.
 */
beforeAll(async () => {
  await applyMigrations();
});

/**
 * Promote a user to admin role directly in the DB.
 * Runs migrations first so the `role` column is guaranteed to exist,
 * regardless of the order in which beforeAll hooks are called.
 *
 * @param {string} userId — UUID of the user to promote
 */
async function promoteToAdmin(userId) {
  await applyMigrations(); // idempotent — safe to call multiple times
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
  await pool.end();
}

/**
 * Register a fresh user and return tokens + user object.
 * @param {object} overrides — override any default field
 */
async function createTestUser(overrides = {}) {
  const unique  = Date.now() + Math.random().toString(36).slice(2);
  const payload = {
    pseudo:       `testuser${unique}`,
    email:        `test${unique}@example.com`,
    password:     overrides.password || 'Password123!',
    birth_date:   '2000-01-01',
    cgu_accepted: true,
    ...overrides,
  };

  const regRes = await request(app).post('/api/v1/auth/register').send(payload);
  if (regRes.status !== 201) throw new Error(`createTestUser failed: ${JSON.stringify(regRes.body)}`);

  return {
    user:         regRes.body.data.user,
    accessToken:  regRes.body.data.access_token,
    refreshToken: regRes.body.data.refresh_token,
    password:     payload.password,
  };
}

/**
 * Returns a supertest-compatible header object for Bearer auth.
 * Usage: .set(authHeader(accessToken))
 * @param {string} token — JWT access token
 * @returns {{ Authorization: string }}
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createTestUser, authHeader, promoteToAdmin };
