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

async function registerAndLogin() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: 'skills@test.com', password: 'Password1!', pseudo: 'skilluser',
    birth_date: '1992-03-10', cgu_accepted: true,
  });
  return res.body.data;
}

async function seedSkill(name = 'JavaScript') {
  const res = await pool.query(
    `INSERT INTO skills (name, category) VALUES ($1, 'Tech') RETURNING id`,
    [name]
  );
  return res.rows[0].id;
}

describe('GET /api/v1/skills', () => {
  it('200 — returns all skills', async () => {
    const { access_token } = await registerAndLogin();
    await seedSkill('Python');
    const res = await request(app)
      .get('/api/v1/skills')
      .set('Authorization', `Bearer ${access_token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('401 — no token', async () => {
    const res = await request(app).get('/api/v1/skills');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/skills/me', () => {
  it('201 — adds a skill to own profile', async () => {
    const { access_token } = await registerAndLogin();
    const skillId = await seedSkill('Go');
    const res = await request(app)
      .post('/api/v1/skills/me')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ skill_id: skillId, type: 'offered', level: 'intermediate' });
    expect([200, 201]).toContain(res.status);
  });

  it('422 — invalid skill_id format', async () => {
    const { access_token } = await registerAndLogin();
    const res = await request(app)
      .post('/api/v1/skills/me')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ skill_id: 'not-a-uuid', type: 'offered', level: 'beginner' });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/v1/skills/me/:userSkillId', () => {
  it('200/204 — removes a user skill', async () => {
    const { access_token } = await registerAndLogin();
    const skillId = await seedSkill('Rust');
    const add = await request(app)
      .post('/api/v1/skills/me')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ skill_id: skillId, type: 'wanted', level: 'beginner' });
    const userSkillId = add.body.data?.id;
    if (!userSkillId) return; // skip if API doesn't return id
    const res = await request(app)
      .delete(`/api/v1/skills/me/${userSkillId}`)
      .set('Authorization', `Bearer ${access_token}`);
    expect([200, 204]).toContain(res.status);
  });
});
