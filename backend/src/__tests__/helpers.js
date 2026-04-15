'use strict';

const request = require('supertest');
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');
const app  = require('../app');

/** Shared pool for direct DB operations in tests. */
function getTestPool() {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  return new Pool({ connectionString });
}

/** Run schema.sql + all migrations against the test DB. Idempotent. */
async function applyMigrations() {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) return;

  const pool = getTestPool();

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

  // Seed minimal skills catalogue so tests can create exchanges
  const SEED_SKILLS = [
    { name: 'JavaScript', category: 'Technology' },
    { name: 'Python',     category: 'Technology' },
    { name: 'English',    category: 'Language'   },
    { name: 'Guitar',     category: 'Music'      },
    { name: 'Cooking',    category: 'Lifestyle'  },
  ];
  for (const s of SEED_SKILLS) {
    await pool.query(
      `INSERT INTO skills (name, category) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
      [s.name, s.category]
    );
  }

  await pool.end();
}

beforeAll(async () => {
  await applyMigrations();
});

/**
 * Promote a user to admin role directly in the DB.
 * @param {string} userId
 */
async function promoteToAdmin(userId) {
  await applyMigrations();
  const pool = getTestPool();
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
  await pool.end();
}

/**
 * Register a fresh user and return tokens + user object.
 * @param {object} overrides
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
 * Alias: returns { user, token } where token is the access token.
 * @param {object} overrides
 */
async function registerAndLogin(overrides = {}) {
  const { user, accessToken } = await createTestUser(overrides);
  return { user, token: accessToken };
}

/**
 * Returns a supertest-compatible Authorization header.
 * @param {string} token
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Get a skill UUID from the catalogue (guaranteed non-empty after applyMigrations)
 * and attach it to the user via POST /api/v1/skills/me.
 *
 * @param {string} token  — access token of the user
 * @returns {Promise<string>} skill UUID
 */
async function seedSkill(token) {
  // Catalogue is guaranteed non-empty because applyMigrations seeds 5 skills.
  const catalogRes = await request(app)
    .get('/api/v1/skills')
    .set(authHeader(token));

  if (catalogRes.status !== 200 || !catalogRes.body.data?.length) {
    // Last-resort: insert directly in DB
    const pool = getTestPool();
    const ins = await pool.query(
      `INSERT INTO skills (name, category)
       VALUES ('TestSkill', 'Test')
       ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category
       RETURNING id`
    );
    await pool.end();
    return ins.rows[0].id;
  }

  const skillId = catalogRes.body.data[0].id;

  // Attach to user (idempotent — 409 on duplicate is fine)
  await request(app)
    .post('/api/v1/skills/me')
    .set(authHeader(token))
    .send({ skill_id: skillId, type: 'offered', level: 'beginner' });

  return skillId;
}

/**
 * Simulate a full completed exchange between two users:
 *   requester creates → partner accepts (PATCH /respond)
 *   → requester confirms (PATCH /confirm) → partner confirms (PATCH /confirm)
 *
 * Both confirmations are required for status to reach 'completed'.
 *
 * @param {string} requesterId
 * @param {string} partnerId
 * @param {string} requesterToken
 * @param {string} partnerToken
 * @returns {Promise<object>} the final exchange row
 */
async function createCompletedExchange(requesterId, partnerId, requesterToken, partnerToken) {
  const skillId = await seedSkill(requesterToken);

  const createRes = await request(app)
    .post('/api/v1/exchanges')
    .set(authHeader(requesterToken))
    .send({
      partner_id:       partnerId,
      skill_id:         skillId,
      duration_minutes: 60,
      desired_date:     new Date(Date.now() + 86400000).toISOString(),
      message:          'Test exchange',
    });

  if (createRes.status !== 201) {
    throw new Error(`createCompletedExchange (create) failed: ${JSON.stringify(createRes.body)}`);
  }

  const exchangeId = createRes.body.data.id;

  const acceptRes = await request(app)
    .patch(`/api/v1/exchanges/${exchangeId}/respond`)
    .set(authHeader(partnerToken))
    .send({ action: 'accept' });

  if (acceptRes.status !== 200) {
    throw new Error(`createCompletedExchange (accept) failed: ${JSON.stringify(acceptRes.body)}`);
  }

  // Requester confirms first
  const confirmRequesterRes = await request(app)
    .patch(`/api/v1/exchanges/${exchangeId}/confirm`)
    .set(authHeader(requesterToken));

  if (confirmRequesterRes.status !== 200) {
    throw new Error(`createCompletedExchange (confirm requester) failed: ${JSON.stringify(confirmRequesterRes.body)}`);
  }

  // Partner confirms second — this triggers status = 'completed' and badge award
  const confirmPartnerRes = await request(app)
    .patch(`/api/v1/exchanges/${exchangeId}/confirm`)
    .set(authHeader(partnerToken));

  if (confirmPartnerRes.status !== 200) {
    throw new Error(`createCompletedExchange (confirm partner) failed: ${JSON.stringify(confirmPartnerRes.body)}`);
  }

  return confirmPartnerRes.body.data;
}

module.exports = { createTestUser, registerAndLogin, authHeader, promoteToAdmin, createCompletedExchange };
