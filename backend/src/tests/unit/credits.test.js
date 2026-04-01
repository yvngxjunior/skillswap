'use strict';

jest.mock('../../database/db', () => ({ query: jest.fn() }));

const pool = require('../../database/db');
const { hasEnoughCredits, applyExchangeCredits } = require('../../services/credits.service');

describe('credits.service unit', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('hasEnoughCredits', () => {
    it('returns true when balance > 0', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ credit_balance: 2 }] });
      await expect(hasEnoughCredits('user-1')).resolves.toBe(true);
    });

    it('returns false when balance is 0', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ credit_balance: 0 }] });
      await expect(hasEnoughCredits('user-1')).resolves.toBe(false);
    });

    it('returns false when user not found (empty rows)', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      await expect(hasEnoughCredits('unknown')).resolves.toBe(false);
    });
  });

  describe('applyExchangeCredits', () => {
    it('issues exactly 2 UPDATE queries', async () => {
      const client = { query: jest.fn().mockResolvedValue({}) };
      await applyExchangeCredits(client, 'teacher-id', 'learner-id');
      expect(client.query).toHaveBeenCalledTimes(2);
    });

    it('first query targets the teacher', async () => {
      const client = { query: jest.fn().mockResolvedValue({}) };
      await applyExchangeCredits(client, 'teacher-id', 'learner-id');
      expect(client.query.mock.calls[0][1]).toEqual(['teacher-id']);
    });

    it('second query targets the learner', async () => {
      const client = { query: jest.fn().mockResolvedValue({}) };
      await applyExchangeCredits(client, 'teacher-id', 'learner-id');
      expect(client.query.mock.calls[1][1]).toEqual(['learner-id']);
    });
  });
});
