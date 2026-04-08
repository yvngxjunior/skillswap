const request = require('supertest');
const app = require('../app');
const { createTestUser, authHeader } = require('./helpers');

describe('Profile', () => {
  describe('GET /api/v1/profile/me', () => {
    it('returns own profile when authenticated', async () => {
      const { accessToken, user } = await createTestUser();
      const res = await request(app).get('/api/v1/profile/me').set(authHeader(accessToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('email', user.email);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/profile/me');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/profile/me', () => {
    it('updates bio and pseudo', async () => {
      const { accessToken } = await createTestUser();
      const res = await request(app)
        .put('/api/v1/profile/me')
        .set(authHeader(accessToken))
        .send({ bio: 'Hello world!' });
      expect(res.status).toBe(200);
      expect(res.body.data.bio).toBe('Hello world!');
    });
  });

  describe('GET /api/v1/profile/:id', () => {
    it('returns public profile of another user', async () => {
      const { user: target } = await createTestUser();
      const { accessToken } = await createTestUser();
      const res = await request(app)
        .get(`/api/v1/profile/${target.id}`)
        .set(authHeader(accessToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', target.id);
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('returns 404 for unknown user', async () => {
      const { accessToken } = await createTestUser();
      const res = await request(app)
        .get('/api/v1/profile/00000000-0000-0000-0000-000000000000')
        .set(authHeader(accessToken));
      expect(res.status).toBe(404);
    });
  });
});
