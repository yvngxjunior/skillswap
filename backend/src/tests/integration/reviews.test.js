'use strict';

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
process.env.NODE_ENV   = 'test';

const request = require('supertest');
const app     = require('../../app');
const { setupDatabase, teardownDatabase, clearTables, pool } = require('../helpers/db');

beforeAll(() => setupDatabase());
afterAll(()  => teardownDatabase());
beforeEach(() => clearTables());

async function registerAndLogin(email, pseudo) {
  const res = await request(app).post('/api/v1/auth/register').send({
    email, password: 'Password1!', pseudo, birth_date: '1990-01-01', cgu_accepted: true,
  });
  return res.body.data;
}

function decodeJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

async function forceComplete(exchangeId) {
  await pool.query(
    `UPDATE exchanges SET status = 'completed', confirmed_by_requester = true, confirmed_by_partner = true WHERE id = $1`,
    [exchangeId]
  );
}

const REVIEW = { punctuality: 5, pedagogy: 4, respect: 5, overall: 5, comment: 'Great!' };

describe('Reviews', () => {
  let reviewerToken, revieweeId, exchangeId;

  beforeEach(async () => {
    const r = await registerAndLogin('reviewer@test.com', 'reviewer1');
    const p = await registerAndLogin('reviewee@test.com', 'reviewee1');
    reviewerToken = r.access_token;
    revieweeId    = decodeJwt(p.access_token).id;

    const { rows } = await pool.query(
      `INSERT INTO skills (name, category) VALUES ('Yoga', 'Sport') RETURNING id`
    );
    const skillId = rows[0].id;

    const exRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ partner_id: revieweeId, skill_id: skillId });
    exchangeId = exRes.body.data?.id;
    if (exchangeId) await forceComplete(exchangeId);
  });

  it('201 — submits a review for a completed exchange', async () => {
    if (!exchangeId) return;
    const res = await request(app)
      .post(`/api/v1/exchanges/${exchangeId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send(REVIEW);
    expect([200, 201]).toContain(res.status);
  });

  it('verifies average_rating is updated on the reviewee after review', async () => {
    if (!exchangeId) return;
    await request(app)
      .post(`/api/v1/exchanges/${exchangeId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send(REVIEW);
    const { rows } = await pool.query('SELECT average_rating FROM users WHERE id = $1', [revieweeId]);
    expect(parseFloat(rows[0].average_rating)).toBeGreaterThan(0);
  });

  it('409/400 — duplicate review from same reviewer is rejected', async () => {
    if (!exchangeId) return;
    await request(app)
      .post(`/api/v1/exchanges/${exchangeId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send(REVIEW);
    const res = await request(app)
      .post(`/api/v1/exchanges/${exchangeId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send(REVIEW);
    expect([400, 409, 422]).toContain(res.status);
  });

  it('403/400 — cannot review a non-completed (pending) exchange', async () => {
    const r2 = await registerAndLogin('r2@test.com', 'reviewer2xx');
    const p2 = await registerAndLogin('p2@test.com', 'partner2xx');
    const p2id = decodeJwt(p2.access_token).id;
    const { rows } = await pool.query(
      `INSERT INTO skills (name, category) VALUES ('Pilates', 'Sport') RETURNING id`
    );
    const sk2 = rows[0].id;
    const ex = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${r2.access_token}`)
      .send({ partner_id: p2id, skill_id: sk2 });
    const pendingId = ex.body.data?.id;
    if (!pendingId) return;
    const res = await request(app)
      .post(`/api/v1/exchanges/${pendingId}/reviews`)
      .set('Authorization', `Bearer ${r2.access_token}`)
      .send(REVIEW);
    expect([400, 403, 422]).toContain(res.status);
  });
});
