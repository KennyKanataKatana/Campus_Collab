const AppealModel = require('../../src/models/AppealModel');
const AppealController = require('../../src/controllers/AppealController');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {}
  };
}

describe('AppealController unit tests', () => {
  beforeEach(() => {
    jest.spyOn(AppealModel, 'createAppeal');
    jest.spyOn(AppealModel, 'readAllAppeals');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createAppeal', () => {
    test('should return 401 when res.locals.userId is undefined', () => {
      const req = { body: { reason: 'Some reason' } };
      const res = mockRes();

      AppealController.createAppeal(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(AppealModel.createAppeal).not.toHaveBeenCalled();
    });

    test('should return 400 when reason is undefined', () => {
      const req = { body: {} };
      const res = mockRes();
      res.locals.userId = 5;

      AppealController.createAppeal(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'reason is missing' });
      expect(AppealModel.createAppeal).not.toHaveBeenCalled();
    });

    test('should return 400 when reason is an empty/whitespace string', () => {
      const req = { body: { reason: '   ' } };
      const res = mockRes();
      res.locals.userId = 5;

      AppealController.createAppeal(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'reason is missing' });
      expect(AppealModel.createAppeal).not.toHaveBeenCalled();
    });

    test('should call AppealModel.createAppeal with report_id when provided', () => {
      const req = { body: { report_id: 42, reason: 'I was not the one who posted that' } };
      const res = mockRes();
      res.locals.userId = 5;
      AppealModel.createAppeal.mockImplementation(() => {});

      AppealController.createAppeal(req, res);

      expect(AppealModel.createAppeal).toHaveBeenCalledWith(
        { user_id: 5, report_id: 42, reason: 'I was not the one who posted that' },
        expect.any(Function)
      );
    });

    test('should call AppealModel.createAppeal with null report_id when missing', () => {
      const req = { body: { reason: 'General appeal, no report id known' } };
      const res = mockRes();
      res.locals.userId = 8;
      AppealModel.createAppeal.mockImplementation(() => {});

      AppealController.createAppeal(req, res);

      expect(AppealModel.createAppeal).toHaveBeenCalledWith(
        { user_id: 8, report_id: null, reason: 'General appeal, no report id known' },
        expect.any(Function)
      );
    });

    test('should return 404 when db error code is 23503 (related report not found)', () => {
      const req = { body: { report_id: 999999, reason: 'Appealing a report that does not exist' } };
      const res = mockRes();
      res.locals.userId = 5;
      AppealModel.createAppeal.mockImplementation((data, callback) => callback({ code: 23503 }));

      AppealController.createAppeal(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Related report not found' });
    });

    test('should return 500 on any other db error code', () => {
      const req = { body: { reason: 'Some reason' } };
      const res = mockRes();
      res.locals.userId = 5;
      AppealModel.createAppeal.mockImplementation((data, callback) => callback({ code: '99999' }));

      AppealController.createAppeal(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });

    test('should return 201 with appeal on success (with report_id)', () => {
      const req = { body: { report_id: 42, reason: 'I was not the one who posted that' } };
      const res = mockRes();
      res.locals.userId = 5;
      const fakeAppeal = { id: 1, user_id: 5, report_id: 42, status: 'PENDING' };
      AppealModel.createAppeal.mockImplementation((data, callback) =>
        callback(null, { rows: [fakeAppeal] })
      );

      AppealController.createAppeal(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Appeal submitted successfully',
        appeal: fakeAppeal
      });
    });

    test('should return 201 with appeal on success (without report_id)', () => {
      const req = { body: { reason: 'General appeal, not sure which report caused this' } };
      const res = mockRes();
      res.locals.userId = 8;
      const fakeAppeal = { id: 2, user_id: 8, report_id: null, status: 'PENDING' };
      AppealModel.createAppeal.mockImplementation((data, callback) =>
        callback(null, { rows: [fakeAppeal] })
      );

      AppealController.createAppeal(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Appeal submitted successfully',
        appeal: fakeAppeal
      });
    });
  });

  describe('readAllAppeals', () => {
    test('should return 500 on db error', () => {
      const res = mockRes();
      AppealModel.readAllAppeals.mockImplementation((callback) => callback(new Error('db fail')));

      AppealController.readAllAppeals({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });

    test('should return 200 with all appeals on success', () => {
      const res = mockRes();
      const rows = [{ id: 1, status: 'PENDING' }, { id: 2, status: 'PENDING' }];
      AppealModel.readAllAppeals.mockImplementation((callback) => callback(null, { rows }));

      AppealController.readAllAppeals({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });
});