'use strict';

jest.mock('../../database/db', () => ({ query: jest.fn() }));

const pool = require('../../database/db');
const { getMessages, sendMessage } = require('../../controllers/messages.controller');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('getMessages', () => {
  const baseReq = { user: { id: 'u1' }, params: { exchangeId: 'ex-1' }, query: {} };

  it('returns 403 when user is not a participant', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const res = makeRes();
    await getMessages(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns messages and marks them as read', async () => {
    const msgs = [{ id: 'm1', content: 'hi' }];
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'ex-1' }] })  // participant check
      .mockResolvedValueOnce({ rows: msgs })                            // SELECT messages
      .mockResolvedValueOnce({});                                       // UPDATE read_at
    const res = makeRes();
    await getMessages(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  it('uses the before cursor when provided', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});
    const req = { ...baseReq, query: { before: 'msg-old' } };
    const res = makeRes();
    await getMessages(req, res);
    // second call should include a cursor sub-query param
    const selectCall = pool.query.mock.calls[1][1];
    expect(selectCall).toContain('msg-old');
  });

  it('returns 500 on unexpected error', async () => {
    pool.query.mockRejectedValueOnce(new Error('db fail'));
    const res = makeRes();
    await getMessages(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('sendMessage', () => {
  const baseReq = { user: { id: 'u1' }, params: { exchangeId: 'ex-1' }, body: { content: 'hello' } };

  it('returns 403 when user is not a participant', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const res = makeRes();
    await sendMessage(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when exchange is not accepted/completed', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'pending' }] });
    const res = makeRes();
    await sendMessage(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('inserts message and returns 201 for accepted exchange', async () => {
    const newMsg = { id: 'm2', content: 'hello' };
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'accepted' }] })
      .mockResolvedValueOnce({ rows: [newMsg] });
    const res = makeRes();
    await sendMessage(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: newMsg }));
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('db fail'));
    const res = makeRes();
    await sendMessage(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
