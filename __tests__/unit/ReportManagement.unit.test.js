jest.mock('../../src/models/db', () => ({
  query: jest.fn()
}));
jest.mock('jsonwebtoken');

const pool = require('../../src/models/db');
const jwt = require('jsonwebtoken');
const ReportModel = require('../../src/models/ReportsModel');
const ReportsController = require('../../src/controllers/ReportsController');
const reportPasskeyMiddleware = require('../../src/middlewares/reportPasskeyMiddleware');
const muteMiddleware = require('../../src/middlewares/muteMiddleware');
const jwtMiddleware = require('../../src/middlewares/jwtMiddleware');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {}
  };
}

describe('ReportModel unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReport', () => {
    test('should build insert query with all report fields', () => {
      const callback = jest.fn();

      const data = {
        reporter_id: 1,
        reported_student_name: 'Alex Tan',
        incident_area: 'Library',
        reason: 'Harassment',
        proof_image_url: 'https://example.com/proof.jpg'
      };

      ReportModel.createReport(data, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/insert into reports/i);
      expect(sql).toMatch(/from users/i);
      expect(sql).toMatch(/returning \*/i);
      expect(values).toEqual([
        1,
        'Alex Tan',
        'Library',
        'Harassment',
        'https://example.com/proof.jpg'
      ]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass null when proof_image_url is missing', () => {
      const callback = jest.fn();

      ReportModel.createReport(
        {
          reporter_id: 2,
          reported_student_name: 'Jamie Lee',
          incident_area: 'Canteen',
          reason: 'Bullying'
        },
        callback
      );

      const [, values, passedCallback] = pool.query.mock.calls[0];

      expect(values).toEqual([2, 'Jamie Lee', 'Canteen', 'Bullying', null]);
      expect(passedCallback).toBe(callback);
    });

    test('should still pass through empty proof_image_url as null', () => {
      const callback = jest.fn();

      ReportModel.createReport(
        {
          reporter_id: 3,
          reported_student_name: 'Chris Lim',
          incident_area: 'Classroom',
          reason: 'Spam',
          proof_image_url: ''
        },
        callback
      );

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([3, 'Chris Lim', 'Classroom', 'Spam', null]);
    });
  });

  describe('readAllReports', () => {
    test('should query all reports with reporter and reported names', () => {
      const callback = jest.fn();

      ReportModel.readAllReports(callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select reports\.\*/i);
      expect(sql).toMatch(/join users as reporter/i);
      expect(sql).toMatch(/join users as reported/i);
      expect(sql).toMatch(/order by reports\.created_at desc/i);
      expect(passedCallback).toBe(callback);
    });

    test('should use the two-argument query form', () => {
      const callback = jest.fn();

      ReportModel.readAllReports(callback);

      expect(pool.query.mock.calls[0]).toHaveLength(2);
    });
  });

  describe('readReportsByReporterId', () => {
    test('should query reports by reporter id', () => {
      const callback = jest.fn();

      ReportModel.readReportsByReporterId({ reporter_id: 15 }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/where reports\.reporter_id = \$1/i);
      expect(sql).toMatch(/order by reports\.created_at desc/i);
      expect(values).toEqual([15]);
      expect(passedCallback).toBe(callback);
    });

    test('should pass any reporter id value directly into the query', () => {
      const callback = jest.fn();

      ReportModel.readReportsByReporterId({ reporter_id: 999 }, callback);

      const [, values] = pool.query.mock.calls[0];

      expect(values).toEqual([999]);
    });
  });

  describe('readReportsByReportedUserId', () => {
    test('should query reports by reported user id', () => {
      const callback = jest.fn();

      ReportModel.readReportsByReportedUserId({ reported_user_id: 27 }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/where reports\.reported_user_id = \$1/i);
      expect(sql).toMatch(/join users as reporter/i);
      expect(sql).toMatch(/join users as reported/i);
      expect(values).toEqual([27]);
      expect(passedCallback).toBe(callback);
    });

    test('should keep parameter order for reported user lookup', () => {
      const callback = jest.fn();

      ReportModel.readReportsByReportedUserId({ reported_user_id: 5 }, callback);

      const [, values] = pool.query.mock.calls[0];

      expect(values[0]).toBe(5);
    });
  });

  describe('readReportableUsers', () => {
    test('should select reportable users ordered by name', () => {
      const callback = jest.fn();

      ReportModel.readReportableUsers(callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/select id, student_name/i);
      expect(sql).toMatch(/from users/i);
      expect(sql).toMatch(/order by student_name asc/i);
      expect(passedCallback).toBe(callback);
    });

    test('should use query without values array', () => {
      const callback = jest.fn();

      ReportModel.readReportableUsers(callback);

      expect(pool.query.mock.calls[0]).toHaveLength(2);
    });
  });

  describe('muteReportedUser', () => {
    test('should update a user into muted state', () => {
      const callback = jest.fn();

      ReportModel.muteReportedUser({ reported_user_id: 44 }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/update users/i);
      expect(sql).toMatch(/set is_muted = true/i);
      expect(sql).toMatch(/muted_reason = 'Muted by admin'/i);
      expect(sql).toMatch(/where id = \$1/i);
      expect(values).toEqual([44]);
      expect(passedCallback).toBe(callback);
    });

    test('should return muted user fields after update', () => {
      const callback = jest.fn();

      ReportModel.muteReportedUser({ reported_user_id: 88 }, callback);

      const [sql] = pool.query.mock.calls[0];

      expect(sql).toMatch(
        /returning id, student_name, is_muted, muted_at, mute_until, muted_reason/i
      );
    });
  });

  describe('readMutedUsers', () => {
    test('should retrieve only muted users', () => {
      const callback = jest.fn();

      ReportModel.readMutedUsers(callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(
        /select id, student_name, is_muted, muted_at, mute_until, muted_reason/i
      );
      expect(sql).toMatch(/from users/i);
      expect(sql).toMatch(/where is_muted = true/i);
      expect(sql).toMatch(/order by muted_at desc/i);
      expect(passedCallback).toBe(callback);
    });

    test('should use the callback-only query signature', () => {
      const callback = jest.fn();

      ReportModel.readMutedUsers(callback);

      expect(pool.query.mock.calls[0]).toHaveLength(2);
    });
  });

  describe('unmuteUser', () => {
    test('should update a user back to unmuted state', () => {
      const callback = jest.fn();

      ReportModel.unmuteUser({ user_id: 19 }, callback);

      expect(pool.query).toHaveBeenCalledTimes(1);

      const [sql, values, passedCallback] = pool.query.mock.calls[0];

      expect(sql).toMatch(/update users/i);
      expect(sql).toMatch(/set is_muted = false/i);
      expect(sql).toMatch(/muted_at = null/i);
      expect(sql).toMatch(/muted_reason = null/i);
      expect(sql).toMatch(/where id = \$1/i);
      expect(values).toEqual([19]);
      expect(passedCallback).toBe(callback);
    });

    test('should return user fields after unmuting', () => {
      const callback = jest.fn();

      ReportModel.unmuteUser({ user_id: 72 }, callback);

      const [sql, values] = pool.query.mock.calls[0];

      expect(sql).toMatch(
        /returning id, student_name, is_muted, muted_at, mute_until, muted_reason/i
      );
      expect(values).toEqual([72]);
    });
  });
});

describe('ReportsController unit tests', () => {
  beforeEach(() => {
    jest.spyOn(ReportModel, 'createReport');
    jest.spyOn(ReportModel, 'readAllReports');
    jest.spyOn(ReportModel, 'readReportsByReporterId');
    jest.spyOn(ReportModel, 'readReportsByReportedUserId');
    jest.spyOn(ReportModel, 'readReportableUsers');
    jest.spyOn(ReportModel, 'muteReportedUser');
    jest.spyOn(ReportModel, 'readMutedUsers');
    jest.spyOn(ReportModel, 'unmuteUser');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createReport', () => {
    test('should return 401 when res.locals.userId is undefined', () => {
      const req = { body: {} };
      const res = mockRes();

      ReportsController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(ReportModel.createReport).not.toHaveBeenCalled();
    });

    test('should return 400 when reported_student_name is missing', () => {
      const req = { body: { incident_area: 'Forum Page', reason: 'Spam' } };
      const res = mockRes();
      res.locals.userId = 1;

      ReportsController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'reported_student_name, incident_area or reason is missing'
      });
      expect(ReportModel.createReport).not.toHaveBeenCalled();
    });

    test('should return 400 when incident_area is missing', () => {
      const req = { body: { reported_student_name: 'John Tan', reason: 'Spam' } };
      const res = mockRes();
      res.locals.userId = 1;

      ReportsController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(ReportModel.createReport).not.toHaveBeenCalled();
    });

    test('should return 400 when reason is missing', () => {
      const req = { body: { reported_student_name: 'John Tan', incident_area: 'Forum Page' } };
      const res = mockRes();
      res.locals.userId = 1;

      ReportsController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(ReportModel.createReport).not.toHaveBeenCalled();
    });

    test('should call ReportModel.createReport with correct payload', () => {
      const req = {
        body: {
          reported_student_name: 'John Tan',
          incident_area: 'Forum Page',
          reason: 'Spam',
          proof_image_url: 'https://example.com/proof.png'
        }
      };
      const res = mockRes();
      res.locals.userId = 1;
      ReportModel.createReport.mockImplementation(() => {});

      ReportsController.createReport(req, res);

      expect(ReportModel.createReport).toHaveBeenCalledWith(
        {
          reporter_id: 1,
          reported_student_name: 'John Tan',
          incident_area: 'Forum Page',
          reason: 'Spam',
          proof_image_url: 'https://example.com/proof.png'
        },
        expect.any(Function)
      );
    });

    test('should return 400 when db error code is 23514 (self-report)', () => {
      const req = {
        body: { reported_student_name: 'Sarah Lim', incident_area: 'Forum Page', reason: 'Spam' }
      };
      const res = mockRes();
      res.locals.userId = 1;
      ReportModel.createReport.mockImplementation((data, callback) => callback({ code: 23514 }));

      ReportsController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'You cannot report yourself' });
    });

    test('should return 404 when db error code is 23503 (fk violation)', () => {
      const req = {
        body: { reported_student_name: 'Nobody', incident_area: 'Forum Page', reason: 'Spam' }
      };
      const res = mockRes();
      res.locals.userId = 1;
      ReportModel.createReport.mockImplementation((data, callback) => callback({ code: 23503 }));

      ReportsController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Reported user not found' });
    });

    test('should return 500 on any other db error code', () => {
      const req = {
        body: { reported_student_name: 'John Tan', incident_area: 'Forum Page', reason: 'Spam' }
      };
      const res = mockRes();
      res.locals.userId = 1;
      ReportModel.createReport.mockImplementation((data, callback) => callback({ code: '99999' }));

      ReportsController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });

    test('should return 404 when no matching user was found (empty rows, no error)', () => {
      const req = {
        body: { reported_student_name: 'Nobody', incident_area: 'Forum Page', reason: 'Spam' }
      };
      const res = mockRes();
      res.locals.userId = 1;
      ReportModel.createReport.mockImplementation((data, callback) => callback(null, { rows: [] }));

      ReportsController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Reported user not found' });
    });

    test('should return 201 with report on success', () => {
      const req = {
        body: { reported_student_name: 'John Tan', incident_area: 'Forum Page', reason: 'Spam' }
      };
      const res = mockRes();
      res.locals.userId = 1;
      const fakeReport = { id: 10, reporter_id: 1, reported_user_id: 4 };
      ReportModel.createReport.mockImplementation((data, callback) =>
        callback(null, { rows: [fakeReport] })
      );

      ReportsController.createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User reported successfully',
        report: fakeReport
      });
    });
  });

  describe('readAllReports', () => {
    test('should return 500 on db error', () => {
      const res = mockRes();
      ReportModel.readAllReports.mockImplementation((callback) => callback(new Error('db fail')));

      ReportsController.readAllReports({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });

    test('should return 200 with all rows on success', () => {
      const res = mockRes();
      const rows = [{ id: 1 }, { id: 2 }];
      ReportModel.readAllReports.mockImplementation((callback) => callback(null, { rows }));

      ReportsController.readAllReports({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('readReportsByReporterId', () => {
    test('should return 500 on db error', () => {
      const req = { params: { reporter_id: '1' } };
      const res = mockRes();
      ReportModel.readReportsByReporterId.mockImplementation((data, callback) =>
        callback(new Error('db fail'))
      );

      ReportsController.readReportsByReporterId(req, res);

      expect(ReportModel.readReportsByReporterId).toHaveBeenCalledWith(
        { reporter_id: '1' },
        expect.any(Function)
      );
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 404 when no reports found for reporter', () => {
      const req = { params: { reporter_id: '99' } };
      const res = mockRes();
      ReportModel.readReportsByReporterId.mockImplementation((data, callback) =>
        callback(null, { rows: [] })
      );

      ReportsController.readReportsByReporterId(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'No reports found for this reporter' });
    });

    test('should return 200 with reports on success', () => {
      const req = { params: { reporter_id: '1' } };
      const res = mockRes();
      const rows = [{ id: 1, reporter_id: 1 }];
      ReportModel.readReportsByReporterId.mockImplementation((data, callback) =>
        callback(null, { rows })
      );

      ReportsController.readReportsByReporterId(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('readReportsByReportedUserId', () => {
    test('should return 500 on db error', () => {
      const req = { params: { reported_user_id: '4' } };
      const res = mockRes();
      ReportModel.readReportsByReportedUserId.mockImplementation((data, callback) =>
        callback(new Error('db fail'))
      );

      ReportsController.readReportsByReportedUserId(req, res);

      expect(ReportModel.readReportsByReportedUserId).toHaveBeenCalledWith(
        { reported_user_id: '4' },
        expect.any(Function)
      );
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 404 when no reports found for reported user', () => {
      const req = { params: { reported_user_id: '99' } };
      const res = mockRes();
      ReportModel.readReportsByReportedUserId.mockImplementation((data, callback) =>
        callback(null, { rows: [] })
      );

      ReportsController.readReportsByReportedUserId(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No reports found for this reported user'
      });
    });

    test('should return 200 with reports on success', () => {
      const req = { params: { reported_user_id: '4' } };
      const res = mockRes();
      const rows = [{ id: 1, reported_user_id: 4 }];
      ReportModel.readReportsByReportedUserId.mockImplementation((data, callback) =>
        callback(null, { rows })
      );

      ReportsController.readReportsByReportedUserId(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('readReportableUsers', () => {
    test('should return 500 on db error', () => {
      const res = mockRes();
      ReportModel.readReportableUsers.mockImplementation((callback) => callback(new Error('db fail')));

      ReportsController.readReportableUsers({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });

    test('should return 200 with users on success', () => {
      const res = mockRes();
      const rows = [{ id: 1, student_name: 'Sarah Lim' }];
      ReportModel.readReportableUsers.mockImplementation((callback) => callback(null, { rows }));

      ReportsController.readReportableUsers({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('muteReportedUser', () => {
    test('should return 500 on db error', () => {
      const req = { params: { reported_user_id: '4' } };
      const res = mockRes();
      ReportModel.muteReportedUser.mockImplementation((data, callback) =>
        callback(new Error('db fail'))
      );

      ReportsController.muteReportedUser(req, res);

      expect(ReportModel.muteReportedUser).toHaveBeenCalledWith(
        { reported_user_id: '4' },
        expect.any(Function)
      );
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 404 when reported user not found', () => {
      const req = { params: { reported_user_id: '99' } };
      const res = mockRes();
      ReportModel.muteReportedUser.mockImplementation((data, callback) =>
        callback(null, { rows: [] })
      );

      ReportsController.muteReportedUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Reported user not found' });
    });

    test('should return 200 with muted user on success', () => {
      const req = { params: { reported_user_id: '4' } };
      const res = mockRes();
      const fakeUser = { id: 4, is_muted: true };
      ReportModel.muteReportedUser.mockImplementation((data, callback) =>
        callback(null, { rows: [fakeUser] })
      );

      ReportsController.muteReportedUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User muted successfully',
        user: fakeUser
      });
    });
  });

  describe('readMutedUsers', () => {
    test('should return 500 on db error', () => {
      const res = mockRes();
      ReportModel.readMutedUsers.mockImplementation((callback) => callback(new Error('db fail')));

      ReportsController.readMutedUsers({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });

    test('should return 200 with muted users on success', () => {
      const res = mockRes();
      const rows = [{ id: 4, is_muted: true }];
      ReportModel.readMutedUsers.mockImplementation((callback) => callback(null, { rows }));

      ReportsController.readMutedUsers({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('unmuteUser', () => {
    test('should return 500 on db error', () => {
      const req = { params: { user_id: '4' } };
      const res = mockRes();
      ReportModel.unmuteUser.mockImplementation((data, callback) => callback(new Error('db fail')));

      ReportsController.unmuteUser(req, res);

      expect(ReportModel.unmuteUser).toHaveBeenCalledWith({ user_id: '4' }, expect.any(Function));
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 404 when muted user not found', () => {
      const req = { params: { user_id: '99' } };
      const res = mockRes();
      ReportModel.unmuteUser.mockImplementation((data, callback) => callback(null, { rows: [] }));

      ReportsController.unmuteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Muted user not found' });
    });

    test('should return 200 with unmuted user on success', () => {
      const req = { params: { user_id: '4' } };
      const res = mockRes();
      const fakeUser = { id: 4, is_muted: false };
      ReportModel.unmuteUser.mockImplementation((data, callback) =>
        callback(null, { rows: [fakeUser] })
      );

      ReportsController.unmuteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User unmuted successfully',
        user: fakeUser
      });
    });
  });

  describe('readMyReceivedReports', () => {
    test('should return 401 when res.locals.userId is undefined', () => {
      const req = {};
      const res = mockRes();

      ReportsController.readMyReceivedReports(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(ReportModel.readReportsByReportedUserId).not.toHaveBeenCalled();
    });

    test('should return 500 on db error', () => {
      const req = {};
      const res = mockRes();
      res.locals.userId = 4;
      ReportModel.readReportsByReportedUserId.mockImplementation((data, callback) =>
        callback(new Error('db fail'))
      );

      ReportsController.readMyReceivedReports(req, res);

      expect(ReportModel.readReportsByReportedUserId).toHaveBeenCalledWith(
        { reported_user_id: 4 },
        expect.any(Function)
      );
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should return 200 with received reports on success', () => {
      const req = {};
      const res = mockRes();
      res.locals.userId = 4;
      const rows = [{ id: 1, reported_user_id: 4 }];
      ReportModel.readReportsByReportedUserId.mockImplementation((data, callback) =>
        callback(null, { rows })
      );

      ReportsController.readMyReceivedReports(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });
});

describe('reportPasskeyMiddleware.verifyReportPasskey', () => {
  test('should return 401 when no passkey header is provided', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    reportPasskeyMiddleware.verifyReportPasskey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Passkey is required to view reports'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 when passkey header is an empty string', () => {
    const req = { headers: { 'x-report-passkey': '' } };
    const res = mockRes();
    const next = jest.fn();

    reportPasskeyMiddleware.verifyReportPasskey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 when passkey is wrong', () => {
    const req = { headers: { 'x-report-passkey': 'wrongpasskey' } };
    const res = mockRes();
    const next = jest.fn();

    reportPasskeyMiddleware.verifyReportPasskey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Wrong passkey. Reports are still hidden.'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next when passkey is correct', () => {
    const req = { headers: { 'x-report-passkey': 'campuscollab123' } };
    const res = mockRes();
    const next = jest.fn();

    reportPasskeyMiddleware.verifyReportPasskey(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('muteMiddleware.checkIfMuted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 401 when res.locals.userId is missing', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or missing user in token'
    });
    expect(pool.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 500 when the db query errors', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 1;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) =>
      callback(new Error('db connection lost'))
    );

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 404 when results is null', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 1;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) => callback(null, null));

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 404 when no user row is found', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 99;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) =>
      callback(null, { rows: [] })
    );

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 with the stored reason when user is muted', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 1;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) =>
      callback(null, {
        rows: [{ id: 1, is_muted: true, muted_reason: 'Repeated spam reports' }]
      })
    );

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'You are muted and cannot perform this action right now',
      muted_reason: 'Repeated spam reports'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 with default reason when muted_reason is null', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 1;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) =>
      callback(null, { rows: [{ id: 1, is_muted: true, muted_reason: null }] })
    );

    muteMiddleware.checkIfMuted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'You are muted and cannot perform this action right now',
      muted_reason: 'Muted by admin'
    });
  });

  test('should call next when user is not muted', () => {
    const req = {};
    const res = mockRes();
    res.locals.userId = 1;
    const next = jest.fn();

    pool.query.mockImplementation((sql, values, callback) =>
      callback(null, { rows: [{ id: 1, is_muted: false }] })
    );

    muteMiddleware.checkIfMuted(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('jwtMiddleware.verifyToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 401 when no authorization header is present', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    jwtMiddleware.verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  test('should return 401 when authorization header does not start with Bearer', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = jest.fn();

    jwtMiddleware.verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 when token is invalid', () => {
    const req = { headers: { authorization: 'Bearer bad.token.here' } };
    const res = mockRes();
    const next = jest.fn();

    jwt.verify.mockImplementation((token, secret, callback) =>
      callback(new Error('invalid signature'))
    );

    jwtMiddleware.verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should set res.locals and call next when token is valid', () => {
    const req = { headers: { authorization: 'Bearer valid.token.here' } };
    const res = mockRes();
    const next = jest.fn();
    const decoded = { userId: 4, timestamp: '2026-08-06T00:00:00.000Z' };

    jwt.verify.mockImplementation((token, secret, callback) => callback(null, decoded));

    jwtMiddleware.verifyToken(req, res, next);

    expect(res.locals.userId).toBe(4);
    expect(res.locals.tokenTimestamp).toBe(decoded.timestamp);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});