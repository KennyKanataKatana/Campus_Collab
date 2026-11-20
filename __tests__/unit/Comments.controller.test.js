const CommentsModel = require('../../src/models/CommentsModel');
const CommentsController = require('../../src/controllers/CommentsController');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {}
  };
}

describe('CommentsController unit tests', () => {
  beforeEach(() => {
    jest.spyOn(CommentsModel, 'readCommentsByPostId');
    jest.spyOn(CommentsModel, 'addComment');
    jest.spyOn(CommentsModel, 'readCommentById');
    jest.spyOn(CommentsModel, 'deleteComment');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('readCommentsByPostId', () => {
    test('should return 400 when post id is invalid', () => {
      const req = {
        params: {
          post_id: 'invalid'
        }
      };

      const res = mockRes();

      CommentsController.readCommentsByPostId(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid post ID.'
      });
      expect(CommentsModel.readCommentsByPostId).not.toHaveBeenCalled();
    });

    test('should call CommentsModel.readCommentsByPostId with numeric post id', () => {
      const req = {
        params: {
          post_id: '12'
        }
      };

      const res = mockRes();

      CommentsModel.readCommentsByPostId.mockImplementation(() => {});

      CommentsController.readCommentsByPostId(req, res);

      expect(CommentsModel.readCommentsByPostId).toHaveBeenCalledWith(
        {
          post_id: 12
        },
        expect.any(Function)
      );
    });

    test('should return 500 on database error', () => {
      const req = {
        params: {
          post_id: '12'
        }
      };

      const res = mockRes();

      CommentsModel.readCommentsByPostId.mockImplementation(
        (data, callback) => callback(new Error('db fail'))
      );

      CommentsController.readCommentsByPostId(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unable to load comments.'
      });
    });

    test('should return 200 with comment rows on success', () => {
      const req = {
        params: {
          post_id: '12'
        }
      };

      const res = mockRes();

      const rows = [
        {
          id: 1,
          post_id: 12,
          user_id: 5,
          content: 'Hello'
        }
      ];

      CommentsModel.readCommentsByPostId.mockImplementation(
        (data, callback) => callback(null, { rows })
      );

      CommentsController.readCommentsByPostId(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('addComment', () => {
    test('should return 400 when post id is invalid', () => {
      const req = {
        params: {
          post_id: 'invalid'
        },
        body: {
          content: 'Hello'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsController.addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid post ID.'
      });
      expect(CommentsModel.addComment).not.toHaveBeenCalled();
    });

    test('should return 401 when user id is missing', () => {
      const req = {
        params: {
          post_id: '12'
        },
        body: {
          content: 'Hello'
        }
      };

      const res = mockRes();

      CommentsController.addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You must be logged in to comment.'
      });
      expect(CommentsModel.addComment).not.toHaveBeenCalled();
    });

    test('should return 400 when comment is empty', () => {
      const req = {
        params: {
          post_id: '12'
        },
        body: {
          content: '   '
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsController.addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Comment cannot be empty.'
      });
      expect(CommentsModel.addComment).not.toHaveBeenCalled();
    });

    test('should return 400 when comment exceeds 500 characters', () => {
      const req = {
        params: {
          post_id: '12'
        },
        body: {
          content: 'a'.repeat(501)
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsController.addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Comment cannot exceed 500 characters.'
      });
      expect(CommentsModel.addComment).not.toHaveBeenCalled();
    });

    test('should trim content and call CommentsModel.addComment', () => {
      const req = {
        params: {
          post_id: '12'
        },
        body: {
          content: '  Hello there  '
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsModel.addComment.mockImplementation(() => {});

      CommentsController.addComment(req, res);

      expect(CommentsModel.addComment).toHaveBeenCalledWith(
        {
          post_id: 12,
          user_id: 5,
          content: 'Hello there'
        },
        expect.any(Function)
      );
    });

    test('should return 404 when database error code is 23503', () => {
      const req = {
        params: {
          post_id: '999999'
        },
        body: {
          content: 'Hello'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsModel.addComment.mockImplementation(
        (data, callback) => callback({ code: '23503' })
      );

      CommentsController.addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Post not found.'
      });
    });

    test('should return 500 on any other database error', () => {
      const req = {
        params: {
          post_id: '12'
        },
        body: {
          content: 'Hello'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsModel.addComment.mockImplementation(
        (data, callback) => callback(new Error('db fail'))
      );

      CommentsController.addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unable to add comment.'
      });
    });

    test('should return 201 with the created comment on success', () => {
      const req = {
        params: {
          post_id: '12'
        },
        body: {
          content: 'Hello'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      const fakeComment = {
        id: 1,
        post_id: 12,
        user_id: 5,
        content: 'Hello'
      };

      CommentsModel.addComment.mockImplementation(
        (data, callback) => callback(null, { rows: [fakeComment] })
      );

      CommentsController.addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(fakeComment);
    });
  });

  describe('deleteComment', () => {
    test('should return 400 when comment id is invalid', () => {
      const req = {
        params: {
          comment_id: 'invalid'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsController.deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid comment ID.'
      });
      expect(CommentsModel.readCommentById).not.toHaveBeenCalled();
    });

    test('should return 401 when user id is missing', () => {
      const req = {
        params: {
          comment_id: '3'
        }
      };

      const res = mockRes();

      CommentsController.deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You must be logged in to delete a comment.'
      });
      expect(CommentsModel.readCommentById).not.toHaveBeenCalled();
    });

    test('should return 500 when reading comment fails', () => {
      const req = {
        params: {
          comment_id: '3'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsModel.readCommentById.mockImplementation(
        (data, callback) => callback(new Error('db fail'))
      );

      CommentsController.deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unable to check the comment.'
      });
    });

    test('should return 404 when comment does not exist', () => {
      const req = {
        params: {
          comment_id: '3'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsModel.readCommentById.mockImplementation(
        (data, callback) => callback(null, { rowCount: 0, rows: [] })
      );

      CommentsController.deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Comment not found.'
      });
    });

    test('should return 403 when user does not own the comment', () => {
      const req = {
        params: {
          comment_id: '3'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsModel.readCommentById.mockImplementation(
        (data, callback) =>
          callback(null, {
            rowCount: 1,
            rows: [
              {
                id: 3,
                user_id: 9
              }
            ]
          })
      );

      CommentsController.deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You can only delete your own comments.'
      });
      expect(CommentsModel.deleteComment).not.toHaveBeenCalled();
    });

    test('should call CommentsModel.deleteComment for the owner', () => {
      const req = {
        params: {
          comment_id: '3'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsModel.readCommentById.mockImplementation(
        (data, callback) =>
          callback(null, {
            rowCount: 1,
            rows: [
              {
                id: 3,
                user_id: 5
              }
            ]
          })
      );

      CommentsModel.deleteComment.mockImplementation(() => {});

      CommentsController.deleteComment(req, res);

      expect(CommentsModel.deleteComment).toHaveBeenCalledWith(
        {
          comment_id: 3,
          user_id: 5
        },
        expect.any(Function)
      );
    });

    test('should return 500 when delete fails', () => {
      const req = {
        params: {
          comment_id: '3'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsModel.readCommentById.mockImplementation(
        (data, callback) =>
          callback(null, {
            rowCount: 1,
            rows: [
              {
                id: 3,
                user_id: 5
              }
            ]
          })
      );

      CommentsModel.deleteComment.mockImplementation(
        (data, callback) => callback(new Error('db fail'))
      );

      CommentsController.deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unable to delete comment.'
      });
    });

    test('should return 404 when delete affects no rows', () => {
      const req = {
        params: {
          comment_id: '3'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      CommentsModel.readCommentById.mockImplementation(
        (data, callback) =>
          callback(null, {
            rowCount: 1,
            rows: [
              {
                id: 3,
                user_id: 5
              }
            ]
          })
      );

      CommentsModel.deleteComment.mockImplementation(
        (data, callback) =>
          callback(null, {
            rowCount: 0,
            rows: []
          })
      );

      CommentsController.deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Comment not found.'
      });
    });

    test('should return 200 with deleted comment on success', () => {
      const req = {
        params: {
          comment_id: '3'
        }
      };

      const res = mockRes();
      res.locals.userId = 5;

      const fakeComment = {
        id: 3,
        post_id: 12,
        user_id: 5,
        content: 'Delete me'
      };

      CommentsModel.readCommentById.mockImplementation(
        (data, callback) =>
          callback(null, {
            rowCount: 1,
            rows: [fakeComment]
          })
      );

      CommentsModel.deleteComment.mockImplementation(
        (data, callback) =>
          callback(null, {
            rowCount: 1,
            rows: [fakeComment]
          })
      );

      CommentsController.deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Comment deleted successfully.',
        deletedComment: fakeComment
      });
    });
  });
});