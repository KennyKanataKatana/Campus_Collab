jest.mock('../../src/models/db', () => ({
  query: jest.fn()
}));

const pool = require('../../src/models/db');
const UserModel = require('../../src/models/UserModel');

describe('UserModel unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readAllUsers', () => {
    test('should select all users', () => {
      const callback = jest.fn();

      UserModel.readAllUsers(callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select \*/i);
      expect(sql).toMatch(/from users/i);
      expect(passedCallback).toBe(callback);
    });

    test('should use the callback-only query signature', () => {
      const callback = jest.fn();

      UserModel.readAllUsers(callback);

      expect(pool.query.mock.calls[0]).toHaveLength(2);
    });
  });

  describe('readUserById', () => {
    test('should select a user by id excluding password_hash', () => {
      const callback = jest.fn();

      UserModel.readUserById({ id: 5 }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select/i);
      expect(sql).toMatch(/id,/i);
      expect(sql).toMatch(/student_name/i);
      expect(sql).toMatch(/student_email/i);
      expect(sql).toMatch(/bio/i);
      expect(sql).not.toMatch(/password_hash/i);
      expect(sql).toMatch(/where id = \$1/i);
      expect(values).toEqual([5]);
      expect(passedCallback).toBe(callback);
    });
  });

  describe('insertUser', () => {
    test('should insert a new user and return the id', () => {
      const callback = jest.fn();

      UserModel.insertUser(
        {
          student_name: 'Alex Tan',
          student_email: 'alex_tan@ichat.sp.edu.sg',
          password_hash: 'hashedvalue',
          bio: "Hello! I'm new to Campus Collab."
        },
        callback
      );

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/insert into users/i);
      expect(sql).toMatch(/returning id/i);
      expect(values).toEqual([
        'Alex Tan',
        'alex_tan@ichat.sp.edu.sg',
        'hashedvalue',
        "Hello! I'm new to Campus Collab."
      ]);
      expect(passedCallback).toBe(callback);
    });
  });

  describe('selectUserByEmail', () => {
    test('should select a user by email including password_hash', () => {
      const callback = jest.fn();

      UserModel.selectUserByEmail({ student_email: 'alex_tan@ichat.sp.edu.sg' }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select id, student_name, student_email, password_hash/i);
      expect(sql).toMatch(/where student_email = \$1/i);
      expect(values).toEqual(['alex_tan@ichat.sp.edu.sg']);
      expect(passedCallback).toBe(callback);
    });
  });

  describe('checkEmailExists', () => {
    test('should select id by email to check existence', () => {
      const callback = jest.fn();

      UserModel.checkEmailExists({ student_email: 'alex_tan@ichat.sp.edu.sg' }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select id/i);
      expect(sql).toMatch(/from users/i);
      expect(sql).toMatch(/where student_email = \$1/i);
      expect(values).toEqual(['alex_tan@ichat.sp.edu.sg']);
      expect(passedCallback).toBe(callback);
    });
  });
});