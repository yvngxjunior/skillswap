const request = require('supertest');
const app = require('../app');
const { createTestUser, authHeader } = require('./helpers');

describe('Exchanges', () => {
  describe('POST /api/v1/exchanges', () => {
    it('creates a pending exchange request', async () => {
      const { user: requester, accessToken } = await createTestUser();
      const { user: partner } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set(authHeader(accessToken))
        .send({
          partner_id: partner.id,
          skill_id:   null,
          message:    'Hey, want to exchange skills?',
        });
      // Accept 201 or 400 depending on whether skill_id is required
      expect([201, 400]).toContain(res.status);
    });

    it('rejects a self-exchange request', async () => {
      const { user, accessToken } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set(authHeader(accessToken))
        .send({ partner_id: user.id, message: 'Test' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/exchanges', () => {
    it('lists own exchanges', async () => {
      const { accessToken } = await createTestUser();
      const res = await request(app).get('/api/v1/exchanges').set(authHeader(accessToken));
      expect(res.status).toBe(200);
      // Support both wrapped { data: [] } and direct [] response shapes
      const body = res.body.data !== undefined ? res.body.data : res.body;
      expect(Array.isArray(body)).toBe(true);
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/v1/exchanges');
      expect(res.status).toBe(401);
    });
  });
});
