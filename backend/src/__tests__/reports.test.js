'use strict';

const request = require('supertest');
const app = require('../app');
const { createTestUser, authHeader } = require('./helpers');

describe('Reports', () => {
  let reporterToken;
  let targetUser;
  let reporterId;

  beforeAll(async () => {
    const reporter = await createTestUser();
    reporterToken = reporter.accessToken;
    reporterId    = reporter.user.id;

    const target = await createTestUser();
    targetUser = target.user;
  });

  // ── POST /api/v1/reports ───────────────────────────────────────────────

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/v1/reports').send({
      target_type: 'user',
      target_id:   targetUser.id,
      reason:      'spam',
    });
    expect(res.status).toBe(401);
  });

  it('rejects missing required fields (400)', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(reporterToken))
      .send({ target_type: 'user' }); // missing target_id and reason
    expect(res.status).toBe(400);
  });

  it('rejects invalid target_type (400)', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(reporterToken))
      .send({ target_type: 'post', target_id: targetUser.id, reason: 'spam' });
    expect(res.status).toBe(400);
  });

  it('rejects self-report (422)', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(reporterToken))
      .send({ target_type: 'user', target_id: reporterId, reason: 'spam' });
    expect(res.status).toBe(422);
  });

  it('creates a report and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(reporterToken))
      .send({
        target_type: 'user',
        target_id:   targetUser.id,
        reason:      'harassment',
        comment:     'Repeated offensive messages.',
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
  });

  it('rejects duplicate report (409)', async () => {
    // Same reporter → same target → same type — already filed above
    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(reporterToken))
      .send({
        target_type: 'user',
        target_id:   targetUser.id,
        reason:      'spam',
      });
    expect(res.status).toBe(409);
  });

  it('accepts a report on a different target_type (exchange)', async () => {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
    // Insert a fake exchange UUID directly so we can report it
    const fakeExchangeId = '00000000-0000-0000-0000-000000000001';
    await pool.end();

    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(reporterToken))
      .send({ target_type: 'exchange', target_id: fakeExchangeId, reason: 'spam' });
    // 201 (new) or 409 (if run twice) — both mean the controller executed
    expect([201, 409]).toContain(res.status);
  });
});
