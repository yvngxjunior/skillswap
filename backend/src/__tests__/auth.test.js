const request = require('supertest');
const app = require('../app');
const { createTestUser } = require('./helpers');

describe('Auth', () => {
  describe('POST /api/v1/auth/register', () => {
    it('registers a valid user', async () => {
      const unique = Date.now();
      const res = await request(app).post('/api/v1/auth/register').send({
        pseudo: `newuser_${unique}`,
        email: `new_${unique}@example.com`,
        password: 'Password123!',
        birthDate: '2000-06-15',
        acceptedCgu: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('rejects age < 15', async () => {
      const unique = Date.now();
      const res = await request(app).post('/api/v1/auth/register').send({
        pseudo: `young_${unique}`,
        email: `young_${unique}@example.com`,
        password: 'Password123!',
        birthDate: new Date(Date.now() - 14 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        acceptedCgu: true,
      });
      expect(res.status).toBe(400);
    });

    it('rejects when CGU not accepted', async () => {
      const unique = Date.now();
      const res = await request(app).post('/api/v1/auth/register').send({
        pseudo: `nocgu_${unique}`,
        email: `nocgu_${unique}@example.com`,
        password: 'Password123!',
        birthDate: '2000-01-01',
        acceptedCgu: false,
      });
      expect(res.status).toBe(400);
    });

    it('rejects duplicate email', async () => {
      const { user } = await createTestUser();
      const res = await request(app).post('/api/v1/auth/register').send({
        pseudo: 'another_pseudo',
        email: user.email,
        password: 'Password123!',
        birthDate: '2000-01-01',
        acceptedCgu: true,
      });
      expect(res.status).toBe(409);
    });

    it('rejects missing required fields', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'incomplete@example.com' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const { user } = await createTestUser({ password: 'MyPass999!' });
      const res = await request(app).post('/api/v1/auth/login').send({
        email: user.email,
        password: 'MyPass999!',
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('rejects wrong password', async () => {
      const { user } = await createTestUser();
      const res = await request(app).post('/api/v1/auth/login').send({
        email: user.email,
        password: 'WrongPass!',
      });
      expect(res.status).toBe(401);
    });

    it('rejects unknown email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nobody@nowhere.com',
        password: 'Password123!',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('rotates refresh token', async () => {
      const { refreshToken } = await createTestUser();
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data.refreshToken).not.toBe(refreshToken); // rotation
    });

    it('rejects an invalid refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'not-a-real-token' });
      expect(res.status).toBe(401);
    });

    it('rejects token reuse after rotation', async () => {
      const { refreshToken } = await createTestUser();
      await request(app).post('/api/v1/auth/refresh').send({ refreshToken }); // rotate once
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken }); // reuse old
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('logs out and invalidates refresh token', async () => {
      const { accessToken, refreshToken } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });
      expect(res.status).toBe(200);
      // Token should now be invalid
      const retry = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(retry.status).toBe(401);
    });
  });
});
