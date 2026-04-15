'use strict';

const request = require('supertest');
const { Pool } = require('pg');
const app = require('../app');
const { createTestUser, authHeader } = require('./helpers');

// Seed a notification directly in the DB
async function seedNotification(userId, type = 'new_message') {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, type, payload)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, type, JSON.stringify({ text: 'test' })]
  );
  await pool.end();
  return rows[0].id;
}

describe('Notifications', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const u = await createTestUser();
    token  = u.accessToken;
    userId = u.user.id;
  });

  // ── GET /api/v1/notifications ─────────────────────────────────────────────

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  it('returns empty list for new user', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('unread');
  });

  it('returns seeded notification', async () => {
    await seedNotification(userId);
    const res = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.meta.unread).toBeGreaterThan(0);
  });

  // ── PATCH /api/v1/notifications/read-all ─────────────────────────────────

  it('marks all as read', async () => {
    await seedNotification(userId, 'exchange_request');
    const res = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set(authHeader(token));
    expect(res.status).toBe(200);
    // Verify unread count drops to 0
    const listRes = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(token));
    expect(listRes.body.meta.unread).toBe(0);
  });

  // ── PATCH /api/v1/notifications/:id/read ────────────────────────────────

  it('marks single notification as read', async () => {
    const notifId = await seedNotification(userId, 'new_review');
    const res = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`)
      .set(authHeader(token));
    expect(res.status).toBe(200);
  });

  it('returns 404 for unknown notification id', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/00000000-0000-0000-0000-000000000099/read')
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });

  it('returns 403 when trying to read another user\'s notification', async () => {
    const other = await createTestUser();
    const notifId = await seedNotification(other.user.id, 'exchange_accepted');
    const res = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`)
      .set(authHeader(token));
    expect(res.status).toBe(403);
  });

  // ── POST /api/v1/notifications/push-token ───────────────────────────────

  it('registers a push token', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/push-token')
      .set(authHeader(token))
      .send({ token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' });
    expect([200, 201]).toContain(res.status);
  });

  it('rejects missing push token (400)', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/push-token')
      .set(authHeader(token))
      .send({});
    expect(res.status).toBe(400);
  });
});
