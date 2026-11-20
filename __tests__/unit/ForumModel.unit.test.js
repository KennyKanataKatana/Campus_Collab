jest.mock('../../src/models/db', () => ({
  query: jest.fn()
}));

const pool = require('../../src/models/db');
const ForumModel = require('../../src/models/ForumModel');

describe('ForumModel unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readAllThreads', () => {
    test('should order by recent (created_at DESC) by default', () => {
      const callback = jest.fn();

      ForumModel.readAllThreads(1, 'recent', callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/order by forum_threads\.created_at desc/i);
      expect(values).toEqual([1]);
      expect(passedCallback).toBe(callback);
    });

    test('should order by like_count when sortBy is likes', () => {
      const callback = jest.fn();

      ForumModel.readAllThreads(2, 'likes', callback);

      const [sql] = pool.query.mock.calls[0];

      expect(sql).toMatch(/order by like_count desc, forum_threads\.created_at desc/i);
    });

    test('should order by dislike_count when sortBy is dislikes', () => {
      const callback = jest.fn();

      ForumModel.readAllThreads(3, 'dislikes', callback);

      const [sql] = pool.query.mock.calls[0];

      expect(sql).toMatch(/order by dislike_count desc, forum_threads\.created_at desc/i);
    });

    test('should fall back to recent ordering for an unrecognised sortBy value', () => {
      const callback = jest.fn();

      ForumModel.readAllThreads(4, 'totally-invalid-sort', callback);

      const [sql] = pool.query.mock.calls[0];

      expect(sql).toMatch(/order by forum_threads\.created_at desc/i);
    });

    test('should include the my_vote subquery scoped to the given user id', () => {
      const callback = jest.fn();

      ForumModel.readAllThreads(9, 'recent', callback);

      const [sql, values] = pool.query.mock.calls[0];

      expect(sql).toMatch(/AS my_vote/i);
      expect(values).toEqual([9]);
    });
  });

  describe('readThreadById', () => {
    test('should query a single thread with vote counts', () => {
      const callback = jest.fn();

      ForumModel.readThreadById({ thread_id: 5, user_id: 1 }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/where forum_threads\.id = \$1/i);
      expect(sql).toMatch(/like_count/i);
      expect(sql).toMatch(/dislike_count/i);
      expect(values).toEqual([5, 1]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass null for user_id when not provided', () => {
      const callback = jest.fn();

      ForumModel.readThreadById({ thread_id: 7 }, callback);

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([7, null]);
    });
  });

  describe('createThread', () => {
    test('should insert a thread with all fields provided', () => {
      const callback = jest.fn();

      ForumModel.createThread(
        {
          user_id: 1,
          location_id: 2,
          title: 'Looking for study buddies',
          content: 'Anyone free this weekend?',
          image_url: 'https://example.com/image.png',
          video_url: 'https://example.com/video.mp4'
        },
        callback
      );

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/insert into forum_threads/i);
      expect(sql).toMatch(/returning \*/i);
      expect(values).toEqual([
        1,
        2,
        'Looking for study buddies',
        'Anyone free this weekend?',
        'https://example.com/image.png',
        'https://example.com/video.mp4'
      ]);
      expect(passedCallback).toBe(callback);
    });

    test('should default image_url and video_url to null when missing', () => {
      const callback = jest.fn();

      ForumModel.createThread(
        {
          user_id: 3,
          location_id: 4,
          title: 'General chat',
          content: 'Just saying hi'
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([3, 4, 'General chat', 'Just saying hi', null, null]);
    });
  });

  describe('readRepliesByThreadId', () => {
    test('should query replies for a thread ordered oldest first', () => {
      const callback = jest.fn();

      ForumModel.readRepliesByThreadId({ thread_id: 10 }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/where forum_replies\.thread_id = \$1/i);
      expect(sql).toMatch(/order by forum_replies\.created_at asc/i);
      expect(values).toEqual([10]);
      expect(passedCallback).toBe(callback);
    });
  });

  describe('createReply', () => {
    test('should insert a reply with thread_id, user_id and content', () => {
      const callback = jest.fn();

      ForumModel.createReply({ thread_id: 10, user_id: 2, content: 'Totally agree!' }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/insert into forum_replies/i);
      expect(sql).toMatch(/returning \*/i);
      expect(values).toEqual([10, 2, 'Totally agree!']);
      expect(passedCallback).toBe(callback);
    });
  });

  describe('deleteThread', () => {
    test('should delete a thread scoped to id and owner', () => {
      const callback = jest.fn();

      ForumModel.deleteThread({ thread_id: 10, user_id: 2 }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/delete from forum_threads/i);
      expect(sql).toMatch(/where id = \$1 and user_id = \$2/i);
      expect(values).toEqual([10, 2]);
      expect(passedCallback).toBe(callback);
    });
  });

  describe('castVote', () => {
    test('should upsert a vote using ON CONFLICT', () => {
      const callback = jest.fn();

      ForumModel.castVote({ thread_id: 10, user_id: 2, vote_type: 'LIKE' }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/insert into forum_thread_votes/i);
      expect(sql).toMatch(/on conflict \(thread_id, user_id\)/i);
      expect(sql).toMatch(/do update set vote_type = excluded\.vote_type/i);
      expect(values).toEqual([10, 2, 'LIKE']);
      expect(passedCallback).toBe(callback);
    });

    test('should pass DISLIKE vote_type through unchanged', () => {
      const callback = jest.fn();

      ForumModel.castVote({ thread_id: 11, user_id: 3, vote_type: 'DISLIKE' }, callback);

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([11, 3, 'DISLIKE']);
    });
  });

  describe('removeVote', () => {
    test('should delete a vote scoped to thread and user', () => {
      const callback = jest.fn();

      ForumModel.removeVote({ thread_id: 10, user_id: 2 }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/delete from forum_thread_votes/i);
      expect(sql).toMatch(/where thread_id = \$1 and user_id = \$2/i);
      expect(values).toEqual([10, 2]);
      expect(passedCallback).toBe(callback);
    });
  });
});