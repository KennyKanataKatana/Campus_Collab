jest.mock('../../src/models/db', () => ({
  query: jest.fn()
}));

const pool = require('../../src/models/db');
const AppealModel = require('../../src/models/AppealModel');

describe('AppealModel unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAppeal', () => {
    test('should build insert query with report_id provided', () => {
      const callback = jest.fn();

      const data = {
        user_id: 5,
        report_id: 42,
        reason: 'I was not the one who posted that'
      };

      AppealModel.createAppeal(data, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/insert into appeals/i);
      expect(sql).toMatch(/returning \*/i);
      expect(values).toEqual([5, 42, 'I was not the one who posted that']);
      expect(passedCallback).toBe(callback);
    });

    test('should pass null when report_id is missing', () => {
      const callback = jest.fn();

      AppealModel.createAppeal(
        {
          user_id: 8,
          reason: 'General appeal, no report id known'
        },
        callback
      );

      const [, values, passedCallback] = pool.query.mock.calls[0];

      expect(values).toEqual([8, null, 'General appeal, no report id known']);
      expect(passedCallback).toBe(callback);
    });

    test('should pass null when report_id is explicitly falsy', () => {
      const callback = jest.fn();

      AppealModel.createAppeal(
        {
          user_id: 11,
          report_id: 0,
          reason: 'Edge case falsy report id'
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([11, null, 'Edge case falsy report id']);
    });
  });

  describe('readAppealsByUserId', () => {
    test('should query appeals scoped to a single user', () => {
      const callback = jest.fn();

      AppealModel.readAppealsByUserId({ user_id: 14 }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select appeals\.\*/i);
      expect(sql).toMatch(/inner join users/i);
      expect(sql).toMatch(/where appeals\.user_id = \$1/i);
      expect(sql).toMatch(/order by appeals\.created_at desc/i);
      expect(values).toEqual([14]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass any user id value directly into the query', () => {
      const callback = jest.fn();

      AppealModel.readAppealsByUserId({ user_id: 999 }, callback);

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([999]);
    });
  });

  describe('readAllAppeals', () => {
    test('should query all appeals joined with student name', () => {
      const callback = jest.fn();

      AppealModel.readAllAppeals(callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select appeals\.\*/i);
      expect(sql).toMatch(/inner join users/i);
      expect(sql).toMatch(/order by appeals\.created_at desc/i);
      expect(passedCallback).toBe(callback);
    });

    test('should use the callback-only query signature', () => {
      const callback = jest.fn();

      AppealModel.readAllAppeals(callback);

      expect(pool.query.mock.calls[0]).toHaveLength(2);
    });
  });
});