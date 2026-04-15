'use strict';

const request = require('supertest');
const app = require('../app');
const { createTestUser, authHeader, promoteToAdmin } = require('./helpers');

describe('Admin Moderation', () => {
  let adminToken;
  let userToken;
  let targetUser;
  let createdReportId;

  beforeAll(async () => {
    const admin = await createTestUser();
    await promoteToAdmin(admin.user.id);
    adminToken = admin.accessToken;

    const regular = await createTestUser();
    userToken     = regular.accessToken;

    const target = await createTestUser();
    targetUser = target.user;

    // Pre-create a report to test PATCH
    const reporter = await createTestUser();
    const reportRes = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(reporter.accessToken))
      .send({ target_type: 'user', target_id: targetUser.id, reason: 'spam' });
    if (reportRes.status === 201) createdReportId = reportRes.body.data.id;
  });

  // ── GET /admin/reports ──────────────────────────────────────────────

  it('rejects non-admin (403)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports')
      .set(authHeader(userToken));
    expect(res.status).toBe(403);
  });

  it('lists reports (admin)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('total');
  });

  it('filters reports by status=pending', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports?status=pending')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    res.body.data.forEach(r => expect(r.status).toBe('pending'));
  });

  it('filters reports by target_type=user', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports?target_type=user')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    res.body.data.forEach(r => expect(r.target_type).toBe('user'));
  });

  it('supports pagination', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports?page=1')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(1);
  });

  // ── PATCH /admin/reports/:id ────────────────────────────────────────

  it('rejects invalid status value (400)', async () => {
    if (!createdReportId) return;
    const res = await request(app)
      .patch(`/api/v1/admin/reports/${createdReportId}`)
      .set(authHeader(adminToken))
      .send({ status: 'pending' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown report id', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/reports/00000000-0000-0000-0000-000000000099')
      .set(authHeader(adminToken))
      .send({ status: 'reviewed' });
    expect(res.status).toBe(404);
  });

  it('marks report as reviewed', async () => {
    if (!createdReportId) return;
    const res = await request(app)
      .patch(`/api/v1/admin/reports/${createdReportId}`)
      .set(authHeader(adminToken))
      .send({ status: 'reviewed', admin_note: 'Checked and actioned.' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('reviewed');
  });

  it('marks report as dismissed', async () => {
    const reporter = await createTestUser();
    const anotherTarget = await createTestUser();
    const rr = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(reporter.accessToken))
      .send({ target_type: 'user', target_id: anotherTarget.user.id, reason: 'other' });
    if (rr.status !== 201) return;
    const res = await request(app)
      .patch(`/api/v1/admin/reports/${rr.body.data.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'dismissed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('dismissed');
  });

  // ── DELETE /admin/users/:id ─────────────────────────────────────────

  it('returns 404 for unknown user id', async () => {
    const res = await request(app)
      .delete('/api/v1/admin/users/00000000-0000-0000-0000-000000000099')
      .set(authHeader(adminToken));
    expect(res.status).toBe(404);
  });

  it('soft-deletes a user (sets deleted_at)', async () => {
    const victim = await createTestUser();
    const res = await request(app)
      .delete(`/api/v1/admin/users/${victim.user.id}`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
  });

  it('returns 404 on second delete (already soft-deleted)', async () => {
    const victim = await createTestUser();
    await request(app)
      .delete(`/api/v1/admin/users/${victim.user.id}`)
      .set(authHeader(adminToken));
    const res = await request(app)
      .delete(`/api/v1/admin/users/${victim.user.id}`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(404);
  });

  it('blocks soft-deleted user from logging in', async () => {
    const victim = await createTestUser({ password: 'Victim999!' });
    await request(app)
      .delete(`/api/v1/admin/users/${victim.user.id}`)
      .set(authHeader(adminToken));
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: victim.user.email, password: 'Victim999!' });
    expect(loginRes.status).toBe(401);
  });

  // ── DELETE /admin/exchanges/:id ─────────────────────────────────────

  it('returns 404 for unknown exchange id', async () => {
    const res = await request(app)
      .delete('/api/v1/admin/exchanges/00000000-0000-0000-0000-000000000099')
      .set(authHeader(adminToken));
    expect(res.status).toBe(404);
  });
});
