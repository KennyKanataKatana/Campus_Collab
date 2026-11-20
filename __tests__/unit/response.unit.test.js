const response = require('../../src/middlewares/response');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {}
  };
}

describe('response.withMessage', () => {
  test('should set res.locals.message and call next, without status', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    response.withMessage('Operation successful')(req, res, next);

    expect(res.locals.message).toBe('Operation successful');
    expect(res.locals.status).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('should set res.locals.status when status is provided', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    response.withMessage('Created', 201)(req, res, next);

    expect(res.locals.message).toBe('Created');
    expect(res.locals.status).toBe(201);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('response.withDynamicMessage', () => {
  test('should build message from builderFn and call next', () => {
    const req = { body: { name: 'Sarah' } };
    const res = mockRes();
    const next = jest.fn();
    const builderFn = (req, res) => `Hello ${req.body.name}`;

    response.withDynamicMessage(builderFn, 200)(req, res, next);

    expect(res.locals.message).toBe('Hello Sarah');
    expect(res.locals.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('should skip setting message when builderFn is not a function', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    response.withDynamicMessage('not a function', 200)(req, res, next);

    expect(res.locals.message).toBeUndefined();
    expect(res.locals.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('should skip setting status when status is null', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    const builderFn = () => 'A message';

    response.withDynamicMessage(builderFn, null)(req, res, next);

    expect(res.locals.message).toBe('A message');
    expect(res.locals.status).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('response.sendResponse', () => {
  test('should default to status 200 and message "Success" when not set', () => {
    const req = {};
    const res = mockRes();
    res.locals = { userId: 5 };

    response.sendResponse(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { userId: 5 }
    });
  });

  test('should use res.locals.status and message when set, excluding them from data', () => {
    const req = {};
    const res = mockRes();
    res.locals = { status: 201, message: 'Created successfully', userId: 5, token: 'abc' };

    response.sendResponse(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Created successfully',
      data: { userId: 5, token: 'abc' }
    });
  });
});