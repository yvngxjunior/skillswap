'use strict';

require('dotenv').config();
process.env.JWT_SECRET  = process.env.JWT_SECRET || 'test_secret';
process.env.NODE_ENV    = 'test';

const request = require('supertest');
const app     = require('../../app');
const { pool, setupDatabase, clearTables } = require('../helpers/db');

beforeAll(() => setupDatabase());
afterAll(()  => pool.end());
beforeEach(() => clearTables());

const VALID_USER = {
  email:        'alice@test.com',
  password:     'Password1!',
  pseudo:       'alice42',
  birth_date:   '1995-06-15',
  cgu_accepted: true,
};

describe('POST /api/v1/auth/register', () => {
  it('201 — registers a new user and returns tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(VALID_USER);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('access_token');
    expect(res.body.data).toHaveProperty('refresh_token');
  });

  it('409 — duplicate email is rejected', async () => {
    await request(app).post('/api/v1/auth/register').send(VALID_USER);
    const res = await request(app).post('/api/v1/auth/register').send(VALID_USER);
    expect(res.status).toBe(409);
  });

  it('422 — missing required field', async () => {
    const { email, ...incomplete } = VALID_USER;
    const res = await request(app).post('/api/v1/auth/register').send(incomplete);
    expect(res.status).toBe(422);
  });

  it('400 — cgu_accepted = false is rejected', async () => {
    // Controller-level business rule guard (runs after Joi) — returns 400, not 422
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...VALID_USER, cgu_accepted: false });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(VALID_USER);
  });

  it('200 — returns tokens on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('access_token');
  });

  it('401 — wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: 'WrongPass99!' });
    expect(res.status).toBe(401);
  });

  it('401 — unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'Password1!' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('200 — exchanges refresh token for a new access token', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send(VALID_USER);
    const { refresh_token } = regRes.body.data;
    const res = await request(app).post('/api/v1/auth/refresh').send({ refresh_token });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('access_token');
  });

  it('401 — invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'totally-invalid-token' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('200/204 — invalidates the session', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send(VALID_USER);
    const { refresh_token } = regRes.body.data;
    const res = await request(app).post('/api/v1/auth/logout').send({ refresh_token });
    expect([200, 204]).toContain(res.status);
  });
});
