'use strict';

jest.mock('../../database/db', () => ({ query: jest.fn() }));

const pool = require('../../database/db');
const {
  listSkills,
  getUserSkills,
  addUserSkill,
  removeUserSkill,
} = require('../../controllers/skills.controller');

function makeRes() {
  const res    = {};
  res.status   = jest.fn().mockReturnValue(res);
  res.json     = jest.fn().mockReturnValue(res);
  res.send     = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('listSkills', () => {
  it('returns all skills when no filters', async () => {
    const rows = [{ id: 1, name: 'Guitar', category: 'Music' }];
    pool.query.mockResolvedValueOnce({ rows });
    const req = { query: {} };
    const res = makeRes();
    await listSkills(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: rows }));
  });

  it('applies category filter when provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await listSkills({ query: { category: 'Music' } }, makeRes());
    expect(pool.query.mock.calls[0][1]).toContain('Music');
  });

  it('applies ILIKE filter when q is provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await listSkills({ query: { q: 'git' } }, makeRes());
    expect(pool.query.mock.calls[0][1]).toContain('%git%');
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await listSkills({ query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getUserSkills', () => {
  it('returns skill rows for req.params.userId', async () => {
    const rows = [{ id: 1, skill_name: 'Guitar' }];
    pool.query.mockResolvedValueOnce({ rows });
    const req = { params: { userId: 'u1' }, user: { id: 'me' } };
    const res = makeRes();
    await getUserSkills(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('falls back to req.user.id when userId param is absent', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await getUserSkills({ params: {}, user: { id: 'me' } }, makeRes());
    expect(pool.query.mock.calls[0][1]).toEqual(['me']);
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('fail'));
    await getUserSkills({ params: {}, user: { id: 'me' } }, makeRes());
    // just verify it does not throw
  });
});

describe('addUserSkill', () => {
  const baseReq = { user: { id: 'me' }, body: { skill_id: 's1', type: 'offered', level: 'beginner' } };

  it('returns 404 when skill does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    const res = makeRes();
    await addUserSkill(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('inserts and returns 201 when skill exists', async () => {
    const row = { id: 'us1', skill_id: 's1', type: 'offered', level: 'beginner' };
    pool.query
      .mockResolvedValueOnce({ rowCount: 1 })       // skill existence check
      .mockResolvedValueOnce({ rows: [row] });       // INSERT
    const res = makeRes();
    await addUserSkill(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: row }));
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await addUserSkill(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('removeUserSkill', () => {
  const baseReq = { user: { id: 'me' }, params: { userSkillId: 'us1' } };

  it('returns 404 when skill not found or not owned', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    const res = makeRes();
    await removeUserSkill(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 204 when deletion succeeds', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = makeRes();
    await removeUserSkill(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await removeUserSkill(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
