jest.mock('../../src/models/db', () => ({
  query: jest.fn()
}));

const pool = require('../../src/models/db');
const AcceptModel = require('../../src/models/AcceptModel');

describe('AcceptModel unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readAcceptancesByPostId', () => {
    test('should query acceptances for a single post', () => {
      const callback = jest.fn();

      AcceptModel.readAcceptancesByPostId(
        {
          id: 12
        },
        callback
      );

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select \*/i);
      expect(sql).toMatch(/from hangout_acceptances/i);
      expect(sql).toMatch(/where post_id = \$1/i);
      expect(sql).toMatch(/order by accepted_at asc/i);
      expect(values).toEqual([12]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass any post id value directly into the query', () => {
      const callback = jest.fn();

      AcceptModel.readAcceptancesByPostId(
        {
          id: 999
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([999]);
    });
  });

  describe('readParticipantsByPostId', () => {
    test('should query host and accepted participants for a post', () => {
      const callback = jest.fn();

      AcceptModel.readParticipantsByPostId(
        {
          id: 15
        },
        callback
      );

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/with participant_rows as/i);
      expect(sql).toMatch(/from hangout_posts hp/i);
      expect(sql).toMatch(/join users u/i);
      expect(sql).toMatch(/union all/i);
      expect(sql).toMatch(/from hangout_acceptances ha/i);
      expect(sql).toMatch(/json_agg/i);
      expect(sql).toMatch(/json_build_object/i);
      expect(sql).toMatch(/where hp\.id = \$1/i);
      expect(values).toEqual([15]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass the post id once for both parts of the participant query', () => {
      const callback = jest.fn();

      AcceptModel.readParticipantsByPostId(
        {
          id: 21
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([21]);
    });
  });

  describe('findPost', () => {
    test('should query a post by id', () => {
      const callback = jest.fn();

      AcceptModel.findPost(
        {
          post_id: 8
        },
        callback
      );

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select \*/i);
      expect(sql).toMatch(/from hangout_posts/i);
      expect(sql).toMatch(/where id = \$1/i);
      expect(values).toEqual([8]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass any post id value directly into the query', () => {
      const callback = jest.fn();

      AcceptModel.findPost(
        {
          post_id: 500
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([500]);
    });
  });

  describe('readAcceptancesByUserId', () => {
    test('should query the accepted hangout for a single user', () => {
      const callback = jest.fn();

      AcceptModel.readAcceptancesByUserId(
        {
          id: 7
        },
        callback
      );

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select/i);
      expect(sql).toMatch(/from hangout_acceptances ha/i);
      expect(sql).toMatch(/join hangout_posts hp/i);
      expect(sql).toMatch(/where ha\.user_id = \$1/i);
      expect(sql).toMatch(/hp\.title/i);
      expect(sql).toMatch(/hp\.current_participants/i);
      expect(sql).toMatch(/hp\.max_participants/i);
      expect(values).toEqual([7]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass any user id value directly into the query', () => {
      const callback = jest.fn();

      AcceptModel.readAcceptancesByUserId(
        {
          id: 999
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([999]);
    });
  });
});