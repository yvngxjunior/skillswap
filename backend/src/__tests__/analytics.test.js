'use strict';

const request = require('supertest');
const app = require('../app');
const { createTestUser, authHeader, promoteToAdmin } = require('./helpers');

describe('Admin Analytics', () => {
  let adminToken;
  let userToken;

  beforeAll(async () => {
    const admin = await createTestUser();
    await promoteToAdmin(admin.user.id);
    adminToken = admin.accessToken;

    const regular = await createTestUser();
    userToken = regular.accessToken;
  });

  // ── requireAdmin middleware ───────────────────────────────────────────

  it('rejects unauthenticated requests to admin routes', async () => {
    const res = await request(app).get('/api/v1/admin/analytics/overview');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users (403)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/overview')
      .set(authHeader(userToken));
    expect(res.status).toBe(403);
  });

  // ── GET /admin/analytics/overview ───────────────────────────────────

  it('returns overview stats for admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/overview')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalUsers');
    expect(res.body.data).toHaveProperty('exchangesByStatus');
    expect(res.body.data).toHaveProperty('totalReviews');
    expect(res.body.data).toHaveProperty('activeUsers7d');
  });

  // ── GET /admin/analytics/exchange-volume ────────────────────────────

  it('returns exchange volume without date filters', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/exchange-volume')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns exchange volume with date filters', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/exchange-volume?from=2020-01-01&to=2030-12-31')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ── GET /admin/analytics/popular-skills ────────────────────────────

  it('returns popular skills list', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/popular-skills')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns popular skills with date filters', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/popular-skills?from=2020-01-01&to=2030-12-31')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ── GET /admin/analytics/user-retention ────────────────────────────

  it('returns user retention cohorts', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/user-retention')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns user retention with date filters', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/user-retention?from=2020-01-01&to=2030-12-31')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
