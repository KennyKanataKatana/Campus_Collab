jest.mock('jsonwebtoken');

const jwt = require('jsonwebtoken');
const jwtMiddleware = require('../../src/middlewares/jwtMiddleware');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {}
  };
}

describe('jwtMiddleware.verifyToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 401 when no authorization header is present', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    jwtMiddleware.verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  test('should return 401 when authorization header does not start with Bearer', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = jest.fn();

    jwtMiddleware.verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 when Bearer prefix is present but token is empty', () => {
    const req = { headers: { authorization: 'Bearer ' } };
    const res = mockRes();
    const next = jest.fn();

    jwtMiddleware.verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  test('should return 401 when token is invalid', () => {
    const req = { headers: { authorization: 'Bearer bad.token.here' } };
    const res = mockRes();
    const next = jest.fn();

    jwt.verify.mockImplementation((token, secret, callback) =>
      callback(new Error('invalid signature'))
    );

    jwtMiddleware.verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should set res.locals and call next when token is valid', () => {
    const req = { headers: { authorization: 'Bearer valid.token.here' } };
    const res = mockRes();
    const next = jest.fn();
    const decoded = { userId: 4, timestamp: '2026-08-06T00:00:00.000Z' };

    jwt.verify.mockImplementation((token, secret, callback) => callback(null, decoded));

    jwtMiddleware.verifyToken(req, res, next);

    expect(res.locals.userId).toBe(4);
    expect(res.locals.tokenTimestamp).toBe(decoded.timestamp);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('jwtMiddleware.generateToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should sign a token with userId and timestamp payload, then call next', () => {
  const req = {};
  const res = mockRes();
  res.locals.userId = 5;
  const next = jest.fn();

  jwt.sign.mockImplementation((payload, secret, options, callback) => {
    callback(null, 'signed.jwt.token');
  });

  jwtMiddleware.generateToken(req, res, next);

  expect(jwt.sign).toHaveBeenCalledTimes(1);

  const [payloadArg, , , callbackArg] = jwt.sign.mock.calls[0];
  expect(payloadArg).toEqual(expect.objectContaining({ userId: 5 }));
  expect(typeof callbackArg).toBe('function');

  expect(res.locals.token).toBe('signed.jwt.token');
  expect(next).toHaveBeenCalledTimes(1);
  expect(res.status).not.toHaveBeenCalled();
});

  test('should return 500 when signing fails', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 5;
    const next = jest.fn();
    const signingError = new Error('signing failed');

    jwt.sign.mockImplementation((payload, secret, options, callback) => {
      callback(signingError);
    });

    jwtMiddleware.generateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(signingError);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('jwtMiddleware.sendToken', () => {
  test('should respond with 200 and the token/user fields from res.locals', () => {
    const req = {};
    const res = mockRes();
    res.locals = {
      message: 'Login successful',
      token: 'signed.jwt.token',
      userId: 5,
      student_name: 'Sarah Lim',
      student_email: 'sarah@ichat.sp.edu.sg'
    };

    jwtMiddleware.sendToken(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Login successful',
      token: 'signed.jwt.token',
      userId: 5,
      student_name: 'Sarah Lim',
      student_email: 'sarah@ichat.sp.edu.sg'
    });
  });
});