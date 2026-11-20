const ForumModel = require('../../src/models/ForumModel');
const ForumController = require('../../src/controllers/ForumController');

function mockRes(overrides = {}) {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: { blockList: [], ...overrides }
  };
}

describe('ForumController unit tests', () => {
  beforeEach(() => {
    jest.spyOn(ForumModel, 'readAllThreads');
    jest.spyOn(ForumModel, 'readThreadById');
    jest.spyOn(ForumModel, 'createThread');
    jest.spyOn(ForumModel, 'readRepliesByThreadId');
    jest.spyOn(ForumModel, 'createReply');
    jest.spyOn(ForumModel, 'deleteThread');
    jest.spyOn(ForumModel, 'castVote');
    jest.spyOn(ForumModel, 'removeVote');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('readAllThreads', () => {
    test('should default to recent sort when no query.sort is provided', () => {
      const req = { query: {} };
      const res = mockRes();
      ForumModel.readAllThreads.mockImplementation((userId, sortBy, cb) =>
        cb(null, { rows: [] })
      );

      ForumController.readAllThreads(req, res);

      expect(ForumModel.readAllThreads).toHaveBeenCalledWith(
        undefined,
        'recent',
        expect.any(Function)
      );
    });

    test('should fall back to recent when sort value is invalid', () => {
      const req = { query: { sort: 'not-a-real-sort' } };
      const res = mockRes();
      ForumModel.readAllThreads.mockImplementation((userId, sortBy, cb) =>
        cb(null, { rows: [] })
      );

      ForumController.readAllThreads(req, res);

      expect(ForumModel.readAllThreads).toHaveBeenCalledWith(
        undefined,
        'recent',
        expect.any(Function)
      );
    });

    test('should pass through a valid sort value', () => {
      const req = { query: { sort: 'likes' } };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.readAllThreads.mockImplementation((userId, sortBy, cb) =>
        cb(null, { rows: [] })
      );

      ForumController.readAllThreads(req, res);

      expect(ForumModel.readAllThreads).toHaveBeenCalledWith(1, 'likes', expect.any(Function));
    });

    test('should return 500 on db error', () => {
      const req = { query: {} };
      const res = mockRes();
      ForumModel.readAllThreads.mockImplementation((userId, sortBy, cb) =>
        cb(new Error('db fail'))
      );

      ForumController.readAllThreads(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should filter out threads from blocked users', () => {
      const req = { query: {} };
      const res = mockRes({ blockList: [2] });
      const rows = [
        { id: 1, user_id: 1, title: 'Visible thread' },
        { id: 2, user_id: 2, title: 'Blocked user thread' }
      ];
      ForumModel.readAllThreads.mockImplementation((userId, sortBy, cb) => cb(null, { rows }));

      ForumController.readAllThreads(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([rows[0]]);
    });

    test('should return 200 with all threads when nobody is blocked', () => {
      const req = { query: {} };
      const res = mockRes({ blockList: [] });
      const rows = [{ id: 1, user_id: 1, title: 'Thread A' }];
      ForumModel.readAllThreads.mockImplementation((userId, sortBy, cb) => cb(null, { rows }));

      ForumController.readAllThreads(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('readThreadById', () => {
    test('should return 500 on db error', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();
      ForumModel.readThreadById.mockImplementation((data, cb) => cb(new Error('db fail')));

      ForumController.readThreadById(req, res);

      expect(ForumModel.readThreadById).toHaveBeenCalledWith(
        { thread_id: '5', user_id: null },
        expect.any(Function)
      );
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 404 when thread does not exist', () => {
      const req = { params: { thread_id: '999' } };
      const res = mockRes();
      ForumModel.readThreadById.mockImplementation((data, cb) => cb(null, { rows: [] }));

      ForumController.readThreadById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Thread not found' });
    });

    test('should pass res.locals.userId through when authenticated', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();
      res.locals.userId = 7;
      ForumModel.readThreadById.mockImplementation((data, cb) => cb(null, { rows: [{ id: 5 }] }));

      ForumController.readThreadById(req, res);

      expect(ForumModel.readThreadById).toHaveBeenCalledWith(
        { thread_id: '5', user_id: 7 },
        expect.any(Function)
      );
    });

    test('should return 200 with the thread on success', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();
      const fakeThread = { id: 5, title: 'A thread' };
      ForumModel.readThreadById.mockImplementation((data, cb) => cb(null, { rows: [fakeThread] }));

      ForumController.readThreadById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(fakeThread);
    });
  });

  describe('createThread', () => {
    test('should return 401 when unauthenticated', () => {
      const req = { body: {} };
      const res = mockRes();

      ForumController.createThread(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(ForumModel.createThread).not.toHaveBeenCalled();
    });

    test('should return 400 when location_id is missing', () => {
      const req = { body: { title: 'T', content: 'C' } };
      const res = mockRes();
      res.locals.userId = 1;

      ForumController.createThread(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(ForumModel.createThread).not.toHaveBeenCalled();
    });

    test('should return 400 when title is missing', () => {
      const req = { body: { location_id: 1, content: 'C' } };
      const res = mockRes();
      res.locals.userId = 1;

      ForumController.createThread(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 400 when content is missing', () => {
      const req = { body: { location_id: 1, title: 'T' } };
      const res = mockRes();
      res.locals.userId = 1;

      ForumController.createThread(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 400 when image_url is not a valid http/https url', () => {
      const req = {
        body: { location_id: 1, title: 'T', content: 'C', image_url: 'not-a-url' }
      };
      const res = mockRes();
      res.locals.userId = 1;

      ForumController.createThread(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Image URL is not valid' });
      expect(ForumModel.createThread).not.toHaveBeenCalled();
    });

    test('should return 400 when image_url uses a non-http protocol', () => {
      const req = {
        body: { location_id: 1, title: 'T', content: 'C', image_url: 'ftp://example.com/a.png' }
      };
      const res = mockRes();
      res.locals.userId = 1;

      ForumController.createThread(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Image URL is not valid' });
    });

    test('should return 400 when video_url is not a valid url', () => {
      const req = {
        body: { location_id: 1, title: 'T', content: 'C', video_url: 'not-a-url' }
      };
      const res = mockRes();
      res.locals.userId = 1;

      ForumController.createThread(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Video URL is not valid' });
    });

    test('should call ForumModel.createThread with correct payload', () => {
      const req = {
        body: {
          location_id: 2,
          title: 'Hello',
          content: 'World',
          image_url: 'https://example.com/a.png'
        }
      };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.createThread.mockImplementation(() => {});

      ForumController.createThread(req, res);

      expect(ForumModel.createThread).toHaveBeenCalledWith(
        {
          user_id: 1,
          location_id: 2,
          title: 'Hello',
          content: 'World',
          image_url: 'https://example.com/a.png',
          video_url: null
        },
        expect.any(Function)
      );
    });

    test('should return 500 on db error', () => {
      const req = { body: { location_id: 2, title: 'Hello', content: 'World' } };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.createThread.mockImplementation((data, cb) => cb(new Error('db fail')));

      ForumController.createThread(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 200 with created thread on success', () => {
      const req = { body: { location_id: 2, title: 'Hello', content: 'World' } };
      const res = mockRes();
      res.locals.userId = 1;
      const fakeThread = { id: 1, title: 'Hello' };
      ForumModel.createThread.mockImplementation((data, cb) => cb(null, { rows: [fakeThread] }));

      ForumController.createThread(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(fakeThread);
    });
  });

  describe('createReply', () => {
    test('should return 401 when unauthenticated', () => {
      const req = { params: {}, body: {} };
      const res = mockRes();

      ForumController.createReply(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(ForumModel.createReply).not.toHaveBeenCalled();
    });

    test('should return 400 when thread_id is missing', () => {
      const req = { params: {}, body: { content: 'Nice post' } };
      const res = mockRes();
      res.locals.userId = 1;

      ForumController.createReply(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 400 when content is missing', () => {
      const req = { params: { thread_id: '5' }, body: {} };
      const res = mockRes();
      res.locals.userId = 1;

      ForumController.createReply(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should call ForumModel.createReply with correct payload', () => {
      const req = { params: { thread_id: '5' }, body: { content: 'Nice post' } };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.createReply.mockImplementation(() => {});

      ForumController.createReply(req, res);

      expect(ForumModel.createReply).toHaveBeenCalledWith(
        { thread_id: '5', user_id: 1, content: 'Nice post' },
        expect.any(Function)
      );
    });

    test('should return 500 on db error', () => {
      const req = { params: { thread_id: '5' }, body: { content: 'Nice post' } };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.createReply.mockImplementation((data, cb) => cb(new Error('db fail')));

      ForumController.createReply(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 200 with created reply on success', () => {
      const req = { params: { thread_id: '5' }, body: { content: 'Nice post' } };
      const res = mockRes();
      res.locals.userId = 1;
      const fakeReply = { id: 1, content: 'Nice post' };
      ForumModel.createReply.mockImplementation((data, cb) => cb(null, { rows: [fakeReply] }));

      ForumController.createReply(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(fakeReply);
    });
  });

  describe('readRepliesByThreadId', () => {
    test('should return 500 on db error', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();
      ForumModel.readRepliesByThreadId.mockImplementation((data, cb) => cb(new Error('db fail')));

      ForumController.readRepliesByThreadId(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should filter out replies from blocked users', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes({ blockList: [2] });
      const rows = [
        { id: 1, user_id: 1, content: 'Visible' },
        { id: 2, user_id: 2, content: 'Blocked' }
      ];
      ForumModel.readRepliesByThreadId.mockImplementation((data, cb) => cb(null, { rows }));

      ForumController.readRepliesByThreadId(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([rows[0]]);
    });

    test('should return 200 with all replies when nobody is blocked', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes({ blockList: [] });
      const rows = [{ id: 1, user_id: 1, content: 'Visible' }];
      ForumModel.readRepliesByThreadId.mockImplementation((data, cb) => cb(null, { rows }));

      ForumController.readRepliesByThreadId(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('deleteThread', () => {
    test('should return 401 when unauthenticated', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();

      ForumController.deleteThread(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(ForumModel.deleteThread).not.toHaveBeenCalled();
    });

    test('should return 500 on db error', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.deleteThread.mockImplementation((data, cb) => cb(new Error('db fail')));

      ForumController.deleteThread(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 403 when the caller does not own the thread', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.deleteThread.mockImplementation((data, cb) => cb(null, { rowCount: 0, rows: [] }));

      ForumController.deleteThread(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'You can only delete your own thread' });
    });

    test('should return 200 with the deleted thread on success', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();
      res.locals.userId = 1;
      const fakeThread = { id: 5, title: 'Deleted thread' };
      ForumModel.deleteThread.mockImplementation((data, cb) =>
        cb(null, { rowCount: 1, rows: [fakeThread] })
      );

      ForumController.deleteThread(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Thread deleted successfully',
        deletedThread: fakeThread
      });
    });
  });

  describe('voteThread', () => {
    test('should return 401 when unauthenticated', () => {
      const req = { params: { thread_id: '5' }, body: { vote_type: 'LIKE' } };
      const res = mockRes();

      ForumController.voteThread(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(ForumModel.castVote).not.toHaveBeenCalled();
    });

    test('should return 400 when vote_type is missing', () => {
      const req = { params: { thread_id: '5' }, body: {} };
      const res = mockRes();
      res.locals.userId = 1;

      ForumController.voteThread(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'vote_type must be LIKE or DISLIKE' });
    });

    test('should return 400 when vote_type is an invalid value', () => {
      const req = { params: { thread_id: '5' }, body: { vote_type: 'MAYBE' } };
      const res = mockRes();
      res.locals.userId = 1;

      ForumController.voteThread(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should call ForumModel.castVote with correct payload', () => {
      const req = { params: { thread_id: '5' }, body: { vote_type: 'LIKE' } };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.castVote.mockImplementation(() => {});

      ForumController.voteThread(req, res);

      expect(ForumModel.castVote).toHaveBeenCalledWith(
        { thread_id: '5', user_id: 1, vote_type: 'LIKE' },
        expect.any(Function)
      );
    });

    test('should return 500 on db error', () => {
      const req = { params: { thread_id: '5' }, body: { vote_type: 'LIKE' } };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.castVote.mockImplementation((data, cb) => cb(new Error('db fail')));

      ForumController.voteThread(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 200 with the vote on success', () => {
      const req = { params: { thread_id: '5' }, body: { vote_type: 'DISLIKE' } };
      const res = mockRes();
      res.locals.userId = 1;
      const fakeVote = { thread_id: 5, user_id: 1, vote_type: 'DISLIKE' };
      ForumModel.castVote.mockImplementation((data, cb) => cb(null, { rows: [fakeVote] }));

      ForumController.voteThread(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(fakeVote);
    });
  });

  describe('removeVote', () => {
    test('should return 401 when unauthenticated', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();

      ForumController.removeVote(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(ForumModel.removeVote).not.toHaveBeenCalled();
    });

    test('should return 500 on db error', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.removeVote.mockImplementation((data, cb) => cb(new Error('db fail')));

      ForumController.removeVote(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 200 with removedVote null when nothing was removed', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();
      res.locals.userId = 1;
      ForumModel.removeVote.mockImplementation((data, cb) => cb(null, { rows: [] }));

      ForumController.removeVote(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Vote removed', removedVote: null });
    });

    test('should return 200 with the removed vote on success', () => {
      const req = { params: { thread_id: '5' } };
      const res = mockRes();
      res.locals.userId = 1;
      const fakeVote = { thread_id: 5, user_id: 1, vote_type: 'LIKE' };
      ForumModel.removeVote.mockImplementation((data, cb) => cb(null, { rows: [fakeVote] }));

      ForumController.removeVote(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Vote removed', removedVote: fakeVote });
    });
  });
});