'use strict';

jest.mock('../../database/db', () => ({ query: jest.fn() }));

const pool = require('../../database/db');
const { getProfile, updateProfile } = require('../../controllers/profile.controller');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

// ─── getProfile ───────────────────────────────────────────────────────────────

describe('getProfile', () => {
  it('returns profile for req.params.userId', async () => {
    const row = { id: 'u1', pseudo: 'alice' };
    // First call: user query; second call: _fetchBadges
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [row] })
      .mockResolvedValueOnce({ rows: [] });          // badges
    const req = { params: { userId: 'u1' }, user: { id: 'me' } };
    const res = makeRes();
    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ id: 'u1', pseudo: 'alice' }) })
    );
  });

  it('falls back to req.user.id when params.userId is absent', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'me' }] })
      .mockResolvedValueOnce({ rows: [] });
    const req = { params: {}, user: { id: 'me' } };
    const res = makeRes();
    await getProfile(req, res);
    expect(pool.query.mock.calls[0][1]).toEqual(['me']);
  });

  it('returns 404 when user not found', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const req = { params: { userId: 'ghost' }, user: { id: 'me' } };
    const res = makeRes();
    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await getProfile({ params: {}, user: { id: 'me' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── updateProfile ────────────────────────────────────────────────────────────

describe('updateProfile', () => {
  const baseReq = { user: { id: 'u1' }, body: { pseudo: 'newpseudo', bio: 'hello' }, file: undefined };

  it('returns 409 when pseudo is already taken by another user', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'other' }] });
    const res = makeRes();
    await updateProfile(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 400 when no fields are provided', async () => {
    const req = { user: { id: 'u1' }, body: {}, file: undefined };
    const res = makeRes();
    await updateProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates pseudo and bio and returns updated row', async () => {
    const row = { id: 'u1', pseudo: 'newpseudo', bio: 'hello' };
    pool.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })  // pseudo uniqueness check
      .mockResolvedValueOnce({ rows: [row] });            // UPDATE
    const res = makeRes();
    await updateProfile(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: row }));
  });

  it('includes photo_url in update when file is uploaded', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'u1', photo_url: '/uploads/avatar.png' }] });
    const req = { user: { id: 'u1' }, body: { pseudo: 'alice' }, file: { filename: 'avatar.png' } };
    const res = makeRes();
    await updateProfile(req, res);
    const updateQuery = pool.query.mock.calls[1][0];
    expect(updateQuery).toContain('photo_url');
  });

  it('updates only bio when pseudo is absent', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'u1', bio: 'updated' }] });
    const req = { user: { id: 'u1' }, body: { bio: 'updated' }, file: undefined };
    const res = makeRes();
    await updateProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await updateProfile(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
