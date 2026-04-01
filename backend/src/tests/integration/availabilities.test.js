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

async function registerAndLogin() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: 'avail@test.com', password: 'Password1!', pseudo: 'availuser',
    birth_date: '1993-07-20', cgu_accepted: true,
  });
  return res.body.data;
}

const SLOTS = [
  { day_of_week: 1, start_time: '09:00', end_time: '11:00' },
  { day_of_week: 3, start_time: '14:00', end_time: '16:00' },
];

describe('PUT /api/v1/availabilities/me', () => {
  it('200 — sets weekly availability slots', async () => {
    const { access_token } = await registerAndLogin();
    const res = await request(app)
      .put('/api/v1/availabilities/me')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ slots: SLOTS });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it('200 — replaces existing slots (full replace / idempotent)', async () => {
    const { access_token } = await registerAndLogin();
    await request(app)
      .put('/api/v1/availabilities/me')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ slots: SLOTS });
    const newSlots = [{ day_of_week: 5, start_time: '10:00', end_time: '12:00' }];
    const res = await request(app)
      .put('/api/v1/availabilities/me')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ slots: newSlots });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('422 — invalid time format is rejected', async () => {
    const { access_token } = await registerAndLogin();
    const res = await request(app)
      .put('/api/v1/availabilities/me')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ slots: [{ day_of_week: 1, start_time: '9:0', end_time: '11:00' }] });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/availabilities/me', () => {
  it('200 — returns own availability slots', async () => {
    const { access_token } = await registerAndLogin();
    await request(app)
      .put('/api/v1/availabilities/me')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ slots: SLOTS });
    const res = await request(app)
      .get('/api/v1/availabilities/me')
      .set('Authorization', `Bearer ${access_token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});
