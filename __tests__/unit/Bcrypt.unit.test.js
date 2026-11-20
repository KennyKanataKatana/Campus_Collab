jest.mock('bcrypt');

const bcrypt = require('bcrypt');
const bcryptMiddleware = require('../../src/middlewares/bcryptMiddleware');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {}
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('bcryptMiddleware.comparePassword', () => {
  test('should call next when password matches', () => {
    const req = { body: { password: 'plaintext123' } };
    const res = mockRes();
    res.locals.hash = 'hashed_value';
    const next = jest.fn();

    bcrypt.compare.mockImplementation((data, hash, callback) => callback(null, true));

    bcryptMiddleware.comparePassword(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should return 401 when password does not match', () => {
    const req = { body: { password: 'wrongpass' } };
    const res = mockRes();
    res.locals.hash = 'hashed_value';
    const next = jest.fn();

    bcrypt.compare.mockImplementation((data, hash, callback) => callback(null, false));

    bcryptMiddleware.comparePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Wrong password' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 500 when bcrypt.compare errors', () => {
    const req = { body: { password: 'plaintext123' } };
    const res = mockRes();
    res.locals.hash = 'hashed_value';
    const next = jest.fn();
    const bcryptError = new Error('bcrypt failure');

    bcrypt.compare.mockImplementation((data, hash, callback) => callback(bcryptError));

    bcryptMiddleware.comparePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(bcryptError);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('bcryptMiddleware.hashPassword', () => {
  test('should set res.locals.hash and call next on success', () => {
    const req = { body: { password: 'plaintext123' } };
    const res = mockRes();
    const next = jest.fn();

    bcrypt.hash.mockImplementation((data, saltRounds, callback) => callback(null, 'hashed_result'));

    bcryptMiddleware.hashPassword(req, res, next);

    expect(res.locals.hash).toBe('hashed_result');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should return 500 when bcrypt.hash errors', () => {
    const req = { body: { password: 'plaintext123' } };
    const res = mockRes();
    const next = jest.fn();
    const bcryptError = new Error('hashing failure');

    bcrypt.hash.mockImplementation((data, saltRounds, callback) => callback(bcryptError));

    bcryptMiddleware.hashPassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(bcryptError);
    expect(next).not.toHaveBeenCalled();
  });
});