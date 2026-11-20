jest.mock('../../src/models/UserModel.js');

const model = require('../../src/models/UserModel.js');
const userController = require('../../src/controllers/UserController.js');

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

describe('UserController.readAllUsers', () => {
  test('should return 200 with all users on success', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    const rows = [{ id: 1, student_name: 'Sarah Lim' }];

    model.readAllUsers.mockImplementation((callback) => {
      callback(null, { rows });
    });

    userController.readAllUsers(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(rows);
  });

  test('should return 500 on db error', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    const dbError = new Error('db failure');

    model.readAllUsers.mockImplementation((callback) => {
      callback(dbError);
    });

    userController.readAllUsers(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(dbError);
  });
});

describe('UserController.readUserById', () => {
  test('should return 200 with the user when found', () => {
    const req = { params: { id: 1 } };
    const res = mockRes();
    const next = jest.fn();
    const row = { id: 1, student_name: 'Sarah Lim' };

    model.readUserById.mockImplementation((data, callback) => {
      callback(null, { length: 1, rows: [row] });
    });

    userController.readUserById(req, res, next);

    expect(model.readUserById).toHaveBeenCalledWith({ id: 1 }, expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(row);
  });

  test('should return 404 when no user is found', () => {
    const req = { params: { id: 999 } };
    const res = mockRes();
    const next = jest.fn();

    model.readUserById.mockImplementation((data, callback) => {
      callback(null, { length: 0, rows: [] });
    });

    userController.readUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  test('should return 500 on db error', () => {
    const req = { params: { id: 1 } };
    const res = mockRes();
    const next = jest.fn();
    const dbError = new Error('db failure');

    model.readUserById.mockImplementation((data, callback) => {
      callback(dbError);
    });

    userController.readUserById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(dbError);
  });
});

describe('UserController.checkEmailExists', () => {
  test('should return 400 when student_name is missing', () => {
    const req = { body: { student_email: 'a@b.com', password: 'pass123' } };
    const res = mockRes();
    const next = jest.fn();

    userController.checkEmailExists(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Name, email or password is missing.' });
    expect(model.checkEmailExists).not.toHaveBeenCalled();
  });

  test('should return 400 when student_email is missing', () => {
    const req = { body: { student_name: 'Sarah', password: 'pass123' } };
    const res = mockRes();
    const next = jest.fn();

    userController.checkEmailExists(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 400 when password is missing', () => {
    const req = { body: { student_name: 'Sarah', student_email: 'a@b.com' } };
    const res = mockRes();
    const next = jest.fn();

    userController.checkEmailExists(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 409 when email already exists', () => {
    const req = { body: { student_name: 'Sarah', student_email: 'a@b.com', password: 'pass123' } };
    const res = mockRes();
    const next = jest.fn();

    model.checkEmailExists.mockImplementation((data, callback) => {
      callback(null, { rows: [{ id: 1 }] });
    });

    userController.checkEmailExists(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email already exists.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next when email does not exist', () => {
    const req = { body: { student_name: 'Sarah', student_email: 'a@b.com', password: 'pass123' } };
    const res = mockRes();
    const next = jest.fn();

    model.checkEmailExists.mockImplementation((data, callback) => {
      callback(null, { rows: [] });
    });

    userController.checkEmailExists(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should return 500 on db error', () => {
    const req = { body: { student_name: 'Sarah', student_email: 'a@b.com', password: 'pass123' } };
    const res = mockRes();
    const next = jest.fn();

    model.checkEmailExists.mockImplementation((data, callback) => {
      callback(new Error('db failure'));
    });

    userController.checkEmailExists(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('UserController.register', () => {
  test('should insert user and set res.locals then call next on success', () => {
    const req = { body: { student_name: 'Sarah Lim', student_email: 'sarah@sp.edu.sg' } };
    const res = mockRes();
    res.locals.hash = 'hashed_password';
    const next = jest.fn();
    const insertedRow = { id: 7, student_name: 'Sarah Lim', student_email: 'sarah@sp.edu.sg' };

    model.insertUser.mockImplementation((data, callback) => {
      callback(null, { rows: [insertedRow] });
    });

    userController.register(req, res, next);

    expect(model.insertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        student_name: 'Sarah Lim',
        student_email: 'sarah@sp.edu.sg',
        password_hash: 'hashed_password',
        bio: "Hello! I'm new to Campus Collab."
      }),
      expect.any(Function)
    );
    expect(res.locals.message).toBe('User Sarah Lim created successfully.');
    expect(res.locals.userId).toBe(7);
    expect(res.locals.student_name).toBe('Sarah Lim');
    expect(res.locals.student_email).toBe('sarah@sp.edu.sg');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('should return 500 on db error', () => {
    const req = { body: { student_name: 'Sarah Lim', student_email: 'sarah@sp.edu.sg' } };
    const res = mockRes();
    res.locals.hash = 'hashed_password';
    const next = jest.fn();

    model.insertUser.mockImplementation((data, callback) => {
      callback(new Error('db failure'));
    });

    userController.register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('UserController.readUserByEmail', () => {
  test('should return 400 when student_email is missing', () => {
    const req = { body: { password: 'pass123' } };
    const res = mockRes();
    const next = jest.fn();

    userController.readUserByEmail(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email or password is missing.' });
    expect(model.selectUserByEmail).not.toHaveBeenCalled();
  });

  test('should return 400 when password is missing', () => {
    const req = { body: { student_email: 'a@b.com' } };
    const res = mockRes();
    const next = jest.fn();

    userController.readUserByEmail(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 401 when no user is found for the email', () => {
    const req = { body: { student_email: 'a@b.com', password: 'pass123' } };
    const res = mockRes();
    const next = jest.fn();

    model.selectUserByEmail.mockImplementation((data, callback) => {
      callback(null, { rows: [] });
    });

    userController.readUserByEmail(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid email or password.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should set res.locals and call next when user is found', () => {
    const req = { body: { student_email: 'a@b.com', password: 'pass123' } };
    const res = mockRes();
    const next = jest.fn();
    const row = {
      id: 3,
      password_hash: 'hashed_pw',
      student_name: 'Sarah Lim',
      student_email: 'a@b.com'
    };

    model.selectUserByEmail.mockImplementation((data, callback) => {
      callback(null, { rows: [row] });
    });

    userController.readUserByEmail(req, res, next);

    expect(res.locals.hash).toBe('hashed_pw');
    expect(res.locals.userId).toBe(3);
    expect(res.locals.student_name).toBe('Sarah Lim');
    expect(res.locals.student_email).toBe('a@b.com');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should return 500 on db error', () => {
    const req = { body: { student_email: 'a@b.com', password: 'pass123' } };
    const res = mockRes();
    const next = jest.fn();

    model.selectUserByEmail.mockImplementation((data, callback) => {
      callback(new Error('db failure'));
    });

    userController.readUserByEmail(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    expect(next).not.toHaveBeenCalled();
  });
});