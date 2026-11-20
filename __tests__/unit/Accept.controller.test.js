jest.mock('../../src/models/db', () => ({
  query: jest.fn()
}));

const AcceptModel = require('../../src/models/AcceptModel');
const AcceptController = require('../../src/controllers/AcceptController');
const pool = require('../../src/models/db');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {}
  };
}

describe('AcceptController unit tests', () => {
  beforeEach(() => {
    jest.spyOn(AcceptModel, 'readAcceptancesByPostId');
    jest.spyOn(AcceptModel, 'readParticipantsByPostId');
    jest.spyOn(AcceptModel, 'acceptPost');
    jest.spyOn(AcceptModel, 'deleteAccept');
    jest.spyOn(AcceptModel, 'readAcceptancesByUserId');

    pool.query.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('readAcceptancesByPostId', () => {
    test('should call AcceptModel.readAcceptancesByPostId with the post id', () => {
      const req = {
        params: {
          post_id: '12'
        }
      };

      const res = mockRes();

      AcceptModel.readAcceptancesByPostId.mockImplementation(() => {});

      AcceptController.readAcceptancesByPostId(req, res);

      expect(AcceptModel.readAcceptancesByPostId).toHaveBeenCalledWith(
        {
          id: '12'
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

      AcceptModel.readAcceptancesByPostId.mockImplementation(
        (data, callback) => callback(new Error('db fail'))
      );

      AcceptController.readAcceptancesByPostId(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error'
      });
    });

    test('should return 200 with acceptance rows on success', () => {
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
          user_id: 20
        },
        {
          id: 2,
          post_id: 12,
          user_id: 21
        }
      ];

      AcceptModel.readAcceptancesByPostId.mockImplementation(
        (data, callback) => callback(null, { rows })
      );

      AcceptController.readAcceptancesByPostId(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('readParticipantsByPostId', () => {
    test('should call AcceptModel.readParticipantsByPostId with the post id', () => {
      const req = {
        params: {
          post_id: '15'
        }
      };

      const res = mockRes();

      AcceptModel.readParticipantsByPostId.mockImplementation(() => {});

      AcceptController.readParticipantsByPostId(req, res);

      expect(AcceptModel.readParticipantsByPostId).toHaveBeenCalledWith(
        {
          id: '15'
        },
        expect.any(Function)
      );
    });

    test('should return 500 on database error', () => {
      const req = {
        params: {
          post_id: '15'
        }
      };

      const res = mockRes();

      AcceptModel.readParticipantsByPostId.mockImplementation(
        (data, callback) => callback(new Error('db fail'))
      );

      AcceptController.readParticipantsByPostId(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error'
      });
    });

    test('should return 404 when the post does not exist', () => {
      const req = {
        params: {
          post_id: '999999'
        }
      };

      const res = mockRes();

      AcceptModel.readParticipantsByPostId.mockImplementation(
        (data, callback) => callback(null, { rows: [] })
      );

      AcceptController.readParticipantsByPostId(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Post not found'
      });
    });

    test('should return 200 with participant details on success', () => {
      const req = {
        params: {
          post_id: '15'
        }
      };

      const res = mockRes();

      const participantData = {
        post_id: 15,
        current_participants: 2,
        max_participants: 5,
        is_full: false,
        participants: [
          {
            user_id: 1,
            student_name: 'Host User',
            is_host: true
          },
          {
            user_id: 2,
            student_name: 'Joined User',
            is_host: false
          }
        ]
      };

      AcceptModel.readParticipantsByPostId.mockImplementation(
        (data, callback) =>
          callback(null, {
            rows: [participantData]
          })
      );

      AcceptController.readParticipantsByPostId(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(participantData);
    });
  });

  describe('acceptPost', () => {
    test('should call AcceptModel.acceptPost with post id and JWT user id', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.acceptPost.mockImplementation(() => {});

      AcceptController.acceptPost(req, res);

      expect(AcceptModel.acceptPost).toHaveBeenCalledWith(
        {
          post_id: '20',
          user_id: 7
        },
        expect.any(Function)
      );
    });

    test('should return 404 when database error code is 23503', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.acceptPost.mockImplementation(
        (data, callback) => callback({ code: '23503' })
      );

      AcceptController.acceptPost(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User or post does not exist'
      });
    });

    test('should return 409 when database error code is 23505', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.acceptPost.mockImplementation(
        (data, callback) => callback({ code: '23505' })
      );

      AcceptController.acceptPost(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'You have already joined a hangout.'
      });
    });

    test('should return 500 on any other model error', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.acceptPost.mockImplementation(
        (data, callback) => callback(new Error('db fail'))
      );

      AcceptController.acceptPost(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error'
      });
    });

    test('should return 404 when model status is POST_NOT_FOUND', () => {
      const req = {
        params: {
          post_id: '999999'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.acceptPost.mockImplementation(
        (data, callback) =>
          callback(null, {
            status: 'POST_NOT_FOUND'
          })
      );

      AcceptController.acceptPost(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Post not found'
      });
    });

    test('should return 409 when user is the post host', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.acceptPost.mockImplementation(
        (data, callback) =>
          callback(null, {
            status: 'HOST',
            current_participants: 1,
            max_participants: 5
          })
      );

      AcceptController.acceptPost(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message:
          'You created this hangout and are already counted as the host.',
        current_participants: 1,
        max_participants: 5
      });
    });

    test('should return 409 when user already accepted the same post', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.acceptPost.mockImplementation(
        (data, callback) =>
          callback(null, {
            status: 'ALREADY_ACCEPTED',
            current_participants: 2,
            max_participants: 5
          })
      );

      AcceptController.acceptPost(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'You have already joined this hangout.',
        current_participants: 2,
        max_participants: 5
      });
    });

    test('should return 409 when user already accepted another post', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.acceptPost.mockImplementation(
        (data, callback) =>
          callback(null, {
            status: 'ALREADY_ACCEPTED_OTHER',
            existing_post_id: 10
          })
      );

      AcceptController.acceptPost(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message:
          'You already joined another hangout. Unaccept it before joining this one.',
        existing_post_id: 10
      });
    });

    test('should return 409 when the hangout is full', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.acceptPost.mockImplementation(
        (data, callback) =>
          callback(null, {
            status: 'FULL',
            current_participants: 5,
            max_participants: 5
          })
      );

      AcceptController.acceptPost(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Sorry, this hangout is already full.',
        isFull: true,
        current_participants: 5,
        max_participants: 5
      });
    });

    test('should return 201 with acceptance details on success', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      const fakeAcceptance = {
        id: 1,
        post_id: 20,
        user_id: 7
      };

      AcceptModel.acceptPost.mockImplementation(
        (data, callback) =>
          callback(null, {
            status: 'ACCEPTED',
            acceptance: fakeAcceptance,
            current_participants: 2,
            max_participants: 5
          })
      );

      AcceptController.acceptPost(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Hangout joined successfully',
        acceptance: fakeAcceptance,
        current_participants: 2,
        max_participants: 5
      });
    });
  });

  describe('cancelAccept', () => {
    test('should call AcceptModel.deleteAccept with post id and JWT user id', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.deleteAccept.mockImplementation(() => {});

      AcceptController.cancelAccept(req, res);

      expect(AcceptModel.deleteAccept).toHaveBeenCalledWith(
        {
          user_id: 7,
          post_id: '20'
        },
        expect.any(Function)
      );
    });

    test('should return 500 on model error', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.deleteAccept.mockImplementation(
        (data, callback) => callback(new Error('db fail'))
      );

      AcceptController.cancelAccept(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error'
      });
    });

    test('should return 404 when model status is POST_NOT_FOUND', () => {
      const req = {
        params: {
          post_id: '999999'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.deleteAccept.mockImplementation(
        (data, callback) =>
          callback(null, {
            status: 'POST_NOT_FOUND'
          })
      );

      AcceptController.cancelAccept(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Post not found'
      });
    });

    test('should return 404 when acceptance does not exist', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      AcceptModel.deleteAccept.mockImplementation(
        (data, callback) =>
          callback(null, {
            status: 'ACCEPTANCE_NOT_FOUND'
          })
      );

      AcceptController.cancelAccept(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Acceptance not found'
      });
    });

    test('should return 200 with deleted acceptance on success', () => {
      const req = {
        params: {
          post_id: '20'
        }
      };

      const res = mockRes();
      res.locals.userId = 7;

      const deletedAcceptance = {
        id: 1,
        post_id: 20,
        user_id: 7
      };

      AcceptModel.deleteAccept.mockImplementation(
        (data, callback) =>
          callback(null, {
            status: 'CANCELLED',
            deleted_acceptance: deletedAcceptance,
            current_participants: 1,
            max_participants: 5
          })
      );

      AcceptController.cancelAccept(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'You left the hangout successfully',
        deletedPost: deletedAcceptance,
        current_participants: 1,
        max_participants: 5
      });
    });
  });

  describe('getAllAcceptancesByUserId', () => {
    test('should call AcceptModel.readAcceptancesByUserId with the user id', () => {
      const req = {
        params: {
          user_id: '8'
        }
      };

      const res = mockRes();

      AcceptModel.readAcceptancesByUserId.mockImplementation(() => {});

      AcceptController.getAllAcceptancesByUserId(req, res);

      expect(AcceptModel.readAcceptancesByUserId).toHaveBeenCalledWith(
        {
          id: '8'
        },
        expect.any(Function)
      );
    });

    test('should return 500 on database error', () => {
      const req = {
        params: {
          user_id: '8'
        }
      };

      const res = mockRes();

      AcceptModel.readAcceptancesByUserId.mockImplementation(
        (data, callback) => callback(new Error('db fail'))
      );

      AcceptController.getAllAcceptancesByUserId(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error'
      });
    });

    test('should return 200 with user acceptance rows on success', () => {
      const req = {
        params: {
          user_id: '8'
        }
      };

      const res = mockRes();

      const rows = [
        {
          id: 1,
          post_id: 20,
          user_id: 8,
          post_title: 'Study Group'
        }
      ];

      AcceptModel.readAcceptancesByUserId.mockImplementation(
        (data, callback) => callback(null, { rows })
      );

      AcceptController.getAllAcceptancesByUserId(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('getAllAcceptances', () => {
    test('should return 200 with all acceptances on success', async () => {
      const req = {};
      const res = mockRes();

      const rows = [
        {
          id: 2,
          post_id: 20,
          user_id: 8
        },
        {
          id: 1,
          post_id: 10,
          user_id: 7
        }
      ];

      pool.query.mockResolvedValue({
        rows
      });

      await AcceptController.getAllAcceptances(req, res);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM hangout_acceptances')
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });

    test('should return 500 on database error', async () => {
      const req = {};
      const res = mockRes();

      pool.query.mockRejectedValue(
        new Error('db fail')
      );

      await AcceptController.getAllAcceptances(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error'
      });
    });
  });
});