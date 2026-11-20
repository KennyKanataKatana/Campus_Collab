jest.mock('../../src/models/db', () => ({
  query: jest.fn()
}));

const pool = require('../../src/models/db');
const muteMiddleware = require('../../src/middlewares/muteMiddleware');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {}
  };
}

describe('muteMiddleware.checkIfMuted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 401 when res.locals.userId is missing', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or missing user in token'
    });
    expect(pool.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 500 when the db query errors', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 1;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) =>
      callback(new Error('db connection lost'))
    );

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 404 when results is null', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 1;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) => callback(null, null));

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 404 when no user row is found', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 99;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) =>
      callback(null, { rows: [] })
    );

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 with the stored reason when user is muted', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 1;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) =>
      callback(null, {
        rows: [{ id: 1, is_muted: true, muted_reason: 'Repeated spam reports' }]
      })
    );

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'You are muted and cannot perform this action right now',
      muted_reason: 'Repeated spam reports'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 with default reason when muted_reason is null', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 1;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) =>
      callback(null, { rows: [{ id: 1, is_muted: true, muted_reason: null }] })
    );

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'You are muted and cannot perform this action right now',
      muted_reason: 'Muted by admin'
    });
  });

  test('should call next when user is not muted', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 1;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) =>
      callback(null, { rows: [{ id: 1, is_muted: false }] })
    );

    muteMiddleware.checkIfMuted(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});