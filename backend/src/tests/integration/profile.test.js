'use strict';

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
process.env.NODE_ENV   = 'test';

const request = require('supertest');
const app     = require('../../app');
const { setupDatabase, teardownDatabase, clearTables } = require('../helpers/db');

beforeAll(() => setupDatabase());
afterAll(()  => teardownDatabase());
beforeEach(() => clearTables());

async function registerAndLogin(overrides = {}) {
  const user = {
    email: 'bob@test.com', password: 'Password1!', pseudo: 'bob42',
    birth_date: '1990-01-01', cgu_accepted: true, ...overrides,
  };
  const res = await request(app).post('/api/v1/auth/register').send(user);
  return res.body.data;
}

describe('GET /api/v1/profile/me', () => {
  it('200 — returns own profile without password_hash', async () => {
    const { access_token } = await registerAndLogin();
    const res = await request(app)
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${access_token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('email', 'bob@test.com');
    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  it('401 — no token', async () => {
    const res = await request(app).get('/api/v1/profile/me');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/profile/me', () => {
  it('200 — updates bio and pseudo', async () => {
    const { access_token } = await registerAndLogin();
    const res = await request(app)
      .put('/api/v1/profile/me')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ pseudo: 'newbob42', bio: 'Hello world' });
    expect(res.status).toBe(200);
    expect(res.body.data.pseudo).toBe('newbob42');
    expect(res.body.data.bio).toBe('Hello world');
  });

  it('401 — no token', async () => {
    const res = await request(app)
      .put('/api/v1/profile/me')
      .send({ bio: 'Hello' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/profile/:userId', () => {
  it('200 — returns public profile of another user', async () => {
    const { access_token } = await registerAndLogin();
    const other = await registerAndLogin({ email: 'carol@test.com', pseudo: 'carol99' });
    // Extract id from JWT payload
    const payload = JSON.parse(Buffer.from(other.access_token.split('.')[1], 'base64').toString());
    const res = await request(app)
      .get(`/api/v1/profile/${payload.id}`)
      .set('Authorization', `Bearer ${access_token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('pseudo', 'carol99');
  });
});
