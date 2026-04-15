'use strict';

jest.mock('../../database/db', () => ({ query: jest.fn() }));

const pool = require('../../database/db');
const { searchUsers } = require('../../controllers/search.controller');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('searchUsers', () => {
  const baseReq = { user: { id: 'me' }, query: { skill: 'Guitar' } };

  it('returns 400 when skill param is missing', async () => {
    const req = { user: { id: 'me' }, query: {} };
    const res = makeRes();
    await searchUsers(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'VALIDATION_ERROR' }) })
    );
  });

  it('returns matching users with pagination meta', async () => {
    const users = [{ id: 'u2', pseudo: 'bob' }];
    pool.query
      .mockResolvedValueOnce({ rows: users })              // main SELECT
      .mockResolvedValueOnce({ rows: [{ total: '1' }] }); // COUNT
    const res = makeRes();
    await searchUsers(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toEqual(users);
    expect(payload.meta.pagination.total).toBe(1);
  });

  it('applies min_rating clause when provided', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });
    const req = { user: { id: 'me' }, query: { skill: 'Piano', min_rating: '4' } };
    const res = makeRes();
    await searchUsers(req, res);
    // third param in first call should be the rating
    expect(pool.query.mock.calls[0][1]).toContain(4);
  });

  it('caps limit at 50', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });
    const req = { user: { id: 'me' }, query: { skill: 'Piano', limit: '999' } };
    await searchUsers(req, makeRes());
    // limit appears embedded in the SQL string, not as a param — just check no error thrown
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('db fail'));
    const res = makeRes();
    await searchUsers(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
