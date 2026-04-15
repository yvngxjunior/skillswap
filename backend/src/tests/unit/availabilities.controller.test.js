'use strict';

jest.mock('../../database/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const pool = require('../../database/db');
const { getAvailabilities, setAvailabilities } = require('../../controllers/availabilities.controller');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function makeClient(queryImpl) {
  return {
    query:   queryImpl || jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('getAvailabilities', () => {
  it('returns rows from the DB for req.params.userId', async () => {
    const rows = [{ id: 1, day_of_week: 1 }];
    pool.query.mockResolvedValueOnce({ rows });
    const req = { params: { userId: 'user-1' }, user: { id: 'me' } };
    const res = makeRes();
    await getAvailabilities(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: rows }));
  });

  it('falls back to req.user.id when userId param is absent', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const req = { params: {}, user: { id: 'me' } };
    await getAvailabilities(req, makeRes());
    expect(pool.query.mock.calls[0][1]).toEqual(['me']);
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('db fail'));
    const req = { params: {}, user: { id: 'me' } };
    const res = makeRes();
    await getAvailabilities(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('setAvailabilities', () => {
  it('replaces slots and returns saved rows', async () => {
    const savedRows = [{ id: 10, day_of_week: 2 }];
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({})   // BEGIN
        .mockResolvedValueOnce({})   // DELETE
        .mockResolvedValueOnce({})   // INSERT slot 1
        .mockResolvedValueOnce({})   // COMMIT
        .mockResolvedValueOnce({ rows: savedRows }) // SELECT
    );
    pool.connect.mockResolvedValueOnce(client);

    const req = { user: { id: 'me' }, body: { slots: [{ day_of_week: 2, start_time: '09:00', end_time: '10:00' }] } };
    const res = makeRes();
    await setAvailabilities(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: savedRows }));
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and returns 500 on DB error', async () => {
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({})                  // BEGIN
        .mockRejectedValueOnce(new Error('fail'))   // DELETE throws
    );
    pool.connect.mockResolvedValueOnce(client);

    const req = { user: { id: 'me' }, body: { slots: [] } };
    const res = makeRes();
    await setAvailabilities(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(client.release).toHaveBeenCalled();
  });
});
