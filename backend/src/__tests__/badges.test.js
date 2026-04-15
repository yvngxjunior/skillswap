'use strict';

const request = require('supertest');
const app     = require('../app');
const { registerAndLogin, authHeader, createCompletedExchange } = require('./helpers');

describe('Badge System', () => {
  let userA, userB;
  let tokenA, tokenB;

  beforeAll(async () => {
    ({ user: userA, token: tokenA } = await registerAndLogin());
    ({ user: userB, token: tokenB } = await registerAndLogin());
  });

  describe('GET /api/v1/badges', () => {
    it('returns the list of available badges without auth', async () => {
      const res = await request(app).get('/api/v1/badges');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      const slugs = res.body.data.map(b => b.slug);
      expect(slugs).toContain('first_exchange');
      expect(slugs).toContain('five_exchanges');
      expect(slugs).toContain('ten_exchanges');
    });

    it('badges are ordered by threshold ascending', async () => {
      const res = await request(app).get('/api/v1/badges');
      const thresholds = res.body.data.map(b => b.threshold);
      const sorted = [...thresholds].sort((a, b) => a - b);
      expect(thresholds).toEqual(sorted);
    });
  });

  describe('Badge award on exchange completion', () => {
    it('awards first_exchange badge after 1st completed exchange', async () => {
      await createCompletedExchange(userA.id, userB.id, tokenA, tokenB);

      // Check profile of userA includes the badge
      const res = await request(app)
        .get(`/api/v1/profile/${userA.id}`)
        .set(authHeader(tokenA));

      expect(res.status).toBe(200);
      const badges = res.body.data.badges;
      expect(Array.isArray(badges)).toBe(true);
      const slugs = badges.map(b => b.slug);
      expect(slugs).toContain('first_exchange');
    });

    it('does not duplicate a badge on a second exchange', async () => {
      await createCompletedExchange(userA.id, userB.id, tokenA, tokenB);

      const res = await request(app)
        .get(`/api/v1/profile/${userA.id}`)
        .set(authHeader(tokenA));

      const firstExchangeBadges = res.body.data.badges.filter(b => b.slug === 'first_exchange');
      expect(firstExchangeBadges.length).toBe(1);
    });

    it('profile includes badges array even when no badge earned yet', async () => {
      const { user: freshUser, token: freshToken } = await registerAndLogin();
      const res = await request(app)
        .get(`/api/v1/profile/${freshUser.id}`)
        .set(authHeader(freshToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.badges)).toBe(true);
      expect(res.body.data.badges.length).toBe(0);
    });
  });

  describe('new_badge notification', () => {
    it('emits a new_badge notification after badge award', async () => {
      const { user: u, token: t } = await registerAndLogin();
      const { user: v, token: s } = await registerAndLogin();

      await createCompletedExchange(u.id, v.id, t, s);

      // Give service a tick to process async notification
      await new Promise(r => setTimeout(r, 100));

      const res = await request(app)
        .get('/api/v1/notifications')
        .set(authHeader(t));

      expect(res.status).toBe(200);
      const badgeNotifs = res.body.data.filter(n => n.type === 'new_badge');
      expect(badgeNotifs.length).toBeGreaterThanOrEqual(1);
      expect(badgeNotifs[0].payload.badgeSlug).toBe('first_exchange');
    });
  });
});
