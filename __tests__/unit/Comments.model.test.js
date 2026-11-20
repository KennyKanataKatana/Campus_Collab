jest.mock('../../src/models/db', () => ({
  query: jest.fn()
}));

const pool = require('../../src/models/db');
const CommentsModel = require('../../src/models/CommentsModel');

describe('CommentsModel unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readCommentsByPostId', () => {
    test('should query comments for a post joined with student name', () => {
      const callback = jest.fn();

      CommentsModel.readCommentsByPostId(
        {
          post_id: 12
        },
        callback
      );

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select/i);
      expect(sql).toMatch(/from hangout_post_comments/i);
      expect(sql).toMatch(/inner join users/i);
      expect(sql).toMatch(/users\.student_name/i);
      expect(sql).toMatch(/where hangout_post_comments\.post_id = \$1/i);
      expect(sql).toMatch(/order by hangout_post_comments\.created_at asc/i);
      expect(values).toEqual([12]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass any post id value directly into the query', () => {
      const callback = jest.fn();

      CommentsModel.readCommentsByPostId(
        {
          post_id: 999
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([999]);
    });
  });

  describe('addComment', () => {
    test('should build insert query with post id, user id, and content', () => {
      const callback = jest.fn();

      const data = {
        post_id: 12,
        user_id: 5,
        content: 'Hello there'
      };

      CommentsModel.addComment(
        data,
        callback
      );

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/insert into hangout_post_comments/i);
      expect(sql).toMatch(/post_id/i);
      expect(sql).toMatch(/user_id/i);
      expect(sql).toMatch(/content/i);
      expect(sql).toMatch(/returning \*/i);
      expect(values).toEqual([12, 5, 'Hello there']);
      expect(passedCallback).toBe(callback);
    });

    test('should pass content exactly as provided by the controller', () => {
      const callback = jest.fn();

      CommentsModel.addComment(
        {
          post_id: 20,
          user_id: 8,
          content: 'Already trimmed'
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([20, 8, 'Already trimmed']);
    });
  });

  describe('readCommentById', () => {
    test('should query a comment by id', () => {
      const callback = jest.fn();

      CommentsModel.readCommentById(
        {
          comment_id: 3
        },
        callback
      );

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select \*/i);
      expect(sql).toMatch(/from hangout_post_comments/i);
      expect(sql).toMatch(/where id = \$1/i);
      expect(values).toEqual([3]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass any comment id value directly into the query', () => {
      const callback = jest.fn();

      CommentsModel.readCommentById(
        {
          comment_id: 999
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([999]);
    });
  });

  describe('deleteComment', () => {
    test('should delete only the comment owned by the user', () => {
      const callback = jest.fn();

      CommentsModel.deleteComment(
        {
          comment_id: 3,
          user_id: 5
        },
        callback
      );

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/delete from hangout_post_comments/i);
      expect(sql).toMatch(/where id = \$1/i);
      expect(sql).toMatch(/and user_id = \$2/i);
      expect(sql).toMatch(/returning \*/i);
      expect(values).toEqual([3, 5]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass comment id and user id in the correct order', () => {
      const callback = jest.fn();

      CommentsModel.deleteComment(
        {
          comment_id: 22,
          user_id: 9
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([22, 9]);
    });
  });
});