const request = require('supertest');
const app = require('../app');
const { createTestUser } = require('./helpers');

describe('Auth', () => {
  describe('POST /api/v1/auth/register', () => {
    it('registers a valid user', async () => {
      const unique = Date.now();
      const res = await request(app).post('/api/v1/auth/register').send({
        pseudo:       `newuser${unique}`,
        email:        `new${unique}@example.com`,
        password:     'Password123!',
        birth_date:   '2000-06-15',
        cgu_accepted: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('access_token');
      expect(res.body.data).toHaveProperty('refresh_token');
    });

    it('rejects age < 15', async () => {
      const unique = Date.now();
      const res = await request(app).post('/api/v1/auth/register').send({
        pseudo:       `young${unique}`,
        email:        `young${unique}@example.com`,
        password:     'Password123!',
        birth_date:   new Date(Date.now() - 14 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        cgu_accepted: true,
      });
      expect(res.status).toBe(400);
    });

    it('rejects when CGU not accepted', async () => {
      const unique = Date.now();
      const res = await request(app).post('/api/v1/auth/register').send({
        pseudo:       `nocgu${unique}`,
        email:        `nocgu${unique}@example.com`,
        password:     'Password123!',
        birth_date:   '2000-01-01',
        cgu_accepted: false,
      });
      expect(res.status).toBe(400);
    });

    it('rejects duplicate email', async () => {
      const { user } = await createTestUser();
      const res = await request(app).post('/api/v1/auth/register').send({
        pseudo:       'anotherpseudo',
        email:        user.email,
        password:     'Password123!',
        birth_date:   '2000-01-01',
        cgu_accepted: true,
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
        email:    user.email,
        password: 'MyPass999!',
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('access_token');
    });

    it('rejects wrong password', async () => {
      const { user } = await createTestUser();
      const res = await request(app).post('/api/v1/auth/login').send({
        email:    user.email,
        password: 'WrongPass!',
      });
      expect(res.status).toBe(401);
    });

    it('rejects unknown email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email:    'nobody@nowhere.com',
        password: 'Password123!',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('rotates refresh token', async () => {
      const { refreshToken } = await createTestUser();
      const res = await request(app).post('/api/v1/auth/refresh').send({ refresh_token: refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data.refresh_token).not.toBe(refreshToken);
    });

    it('rejects an invalid refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({ refresh_token: 'not-a-real-token' });
      expect(res.status).toBe(401);
    });

    it('rejects token reuse after rotation', async () => {
      const { refreshToken } = await createTestUser();
      await request(app).post('/api/v1/auth/refresh').send({ refresh_token: refreshToken });
      const res = await request(app).post('/api/v1/auth/refresh').send({ refresh_token: refreshToken });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('logs out and invalidates refresh token', async () => {
      const { accessToken, refreshToken } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refresh_token: refreshToken });
      expect(res.status).toBe(200);
      const retry = await request(app).post('/api/v1/auth/refresh').send({ refresh_token: refreshToken });
      expect(retry.status).toBe(401);
    });
  });
});
