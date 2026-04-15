'use strict';

const request = require('supertest');
const app     = require('../app');
const { createTestUser, authHeader } = require('./helpers');

describe('Profile GDPR', () => {
  let user;

  beforeAll(async () => {
    user = await createTestUser();
  });

  // ── GET /api/v1/profile/me/data ────────────────────────────────────
  describe('GET /api/v1/profile/me/data', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/profile/me/data');
      expect(res.status).toBe(401);
    });

    it('returns full data export for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/profile/me/data')
        .set(authHeader(user.accessToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('profile');
      expect(res.body.data).toHaveProperty('skills');
      expect(res.body.data).toHaveProperty('exchanges');
      expect(res.body.data).toHaveProperty('reviews');
      expect(res.body.data).toHaveProperty('messages');
      expect(res.body.data.profile.id).toBe(user.user.id);
    });
  });

  // ── DELETE /api/v1/profile/me ──────────────────────────────────────
  describe('DELETE /api/v1/profile/me', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).delete('/api/v1/profile/me');
      expect(res.status).toBe(401);
    });

    it('anonymises account and returns 204', async () => {
      // Use a fresh user so we don't break other tests
      const victim = await createTestUser();

      const res = await request(app)
        .delete('/api/v1/profile/me')
        .set(authHeader(victim.accessToken));

      expect(res.status).toBe(204);
    });

    it('blocks login after account deletion', async () => {
      const victim = await createTestUser();

      await request(app)
        .delete('/api/v1/profile/me')
        .set(authHeader(victim.accessToken));

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: victim.user.email, password: victim.password });

      // Email is now anonymised — credentials no longer valid
      expect(loginRes.status).toBe(401);
    });
  });
});
