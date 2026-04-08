const request = require('supertest');
const app = require('../app');
const { createTestUser, authHeader } = require('./helpers');

describe('Reviews', () => {
  describe('GET /api/v1/users/:id/reviews', () => {
    it('returns reviews for a user', async () => {
      const { user: target } = await createTestUser();
      const { accessToken } = await createTestUser();
      const res = await request(app)
        .get(`/api/v1/users/${target.id}/reviews`)
        .set(authHeader(accessToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/exchanges/:id/review', () => {
    it('returns 404 for a non-existent exchange', async () => {
      const { accessToken } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/exchanges/00000000-0000-0000-0000-000000000000/review')
        .set(authHeader(accessToken))
        .send({ overallRating: 5, comment: 'Great!' });
      expect([404, 400]).toContain(res.status);
    });
  });
});
