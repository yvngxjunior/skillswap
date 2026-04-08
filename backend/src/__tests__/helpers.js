const request = require('supertest');
const app = require('../app');

/**
 * Register + login a test user, return { user, accessToken, refreshToken }
 *
 * The registration endpoint expects snake_case fields:
 *   pseudo, email, password, birth_date, cgu_accepted
 * and returns:
 *   { user, access_token, refresh_token }
 */
async function createTestUser(overrides = {}) {
  const unique = Date.now() + Math.random().toString(36).slice(2, 7);
  const payload = {
    pseudo: overrides.pseudo || `user${unique}`,          // alphanumeric only
    email: overrides.email || `test${unique}@example.com`,
    password: overrides.password || 'Password123!',
    birth_date: overrides.birth_date || '2000-01-01',     // snake_case — required by controller
    cgu_accepted: overrides.cgu_accepted !== undefined
      ? overrides.cgu_accepted
      : true,                                             // snake_case — required by controller
    ...overrides,
  };

  const regRes = await request(app).post('/api/v1/auth/register').send(payload);
  if (regRes.status !== 201) throw new Error(`createTestUser failed: ${JSON.stringify(regRes.body)}`);

  return {
    user: regRes.body.user,                  // controller returns { user, access_token, refresh_token }
    accessToken: regRes.body.access_token,
    refreshToken: regRes.body.refresh_token,
  };
}

/**
 * Returns Authorization header object
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createTestUser, authHeader };
