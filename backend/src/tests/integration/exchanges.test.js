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

async function seedSkill(name) {
  const res = await pool.query(
    `INSERT INTO skills (name, category) VALUES ($1, 'Misc') RETURNING id`,
    [name]
  );
  return res.rows[0].id;
}

function decodeJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

describe('Exchange lifecycle', () => {
  let requesterToken, partnerToken, requesterUser, partnerUser, skillId;

  beforeEach(async () => {
    const r = await registerAndLogin('requester@test.com', 'requester1');
    const p = await registerAndLogin('partner@test.com',   'partner1');
    requesterToken = r.access_token;
    partnerToken   = p.access_token;
    requesterUser  = { id: decodeJwt(r.access_token).id };
    partnerUser    = { id: decodeJwt(p.access_token).id };
    skillId = await seedSkill('Photography');
  });

  it('201 — creates a pending exchange request', async () => {
    const res = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ partner_id: partnerUser.id, skill_id: skillId, duration_minutes: 60 });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('pending');
  });

  it('full lifecycle: create → accept → dual confirm → completed + credits transferred', async () => {
    // 1. Create
    const createRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ partner_id: partnerUser.id, skill_id: skillId });
    expect(createRes.status).toBe(201);
    const exchangeId = createRes.body.data.id;

    // 2. Partner accepts
    const acceptRes = await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/respond`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ action: 'accept' });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe('accepted');

    // 3. Requester confirms
    await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/confirm`)
      .set('Authorization', `Bearer ${requesterToken}`);

    // 4. Partner confirms → completed
    const confirmRes = await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/confirm`)
      .set('Authorization', `Bearer ${partnerToken}`);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('completed');

    // 5. Credit verification
    const partnerProfile   = await request(app).get('/api/v1/profile/me').set('Authorization', `Bearer ${partnerToken}`);
    const requesterProfile = await request(app).get('/api/v1/profile/me').set('Authorization', `Bearer ${requesterToken}`);
    expect(partnerProfile.body.data.credit_balance).toBe(3);   // partner taught: +1
    expect(requesterProfile.body.data.credit_balance).toBe(1); // requester learnt: -1
  });

  it('402/403/400 — rejects exchange creation when requester has 0 credits', async () => {
    await pool.query('UPDATE users SET credit_balance = 0 WHERE id = $1', [requesterUser.id]);
    const res = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ partner_id: partnerUser.id, skill_id: skillId });
    expect([400, 402, 403, 422]).toContain(res.status);
  });

  it('200 — partner can cancel a pending exchange', async () => {
    const createRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ partner_id: partnerUser.id, skill_id: skillId });
    const exchangeId = createRes.body.data.id;
    const res = await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/respond`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ action: 'cancel' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });
});
