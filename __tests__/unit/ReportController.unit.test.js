const ReportModel = require('../../src/models/ReportsModel');
const ReportsController = require('../../src/controllers/ReportsController');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {}
  };
}

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