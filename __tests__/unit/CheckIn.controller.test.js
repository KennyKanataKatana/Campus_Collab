jest.mock('../../src/models/CheckInModel', () => ({
  getEligibility: jest.fn(),
  insertSingle: jest.fn(),
  selectByUserId: jest.fn(),
  selectEligibleByUserId: jest.fn(),
  deleteSingle: jest.fn(),
}));

const model = require('../../src/models/CheckInModel');
const controller = require('../../src/controllers/CheckInController');

function createResponse(userId = 7) {
  const res = {
    locals: { userId: userId },
    status: jest.fn(),
    json: jest.fn(),
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('CheckIn controller', () => {
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('rejects an invalid post ID when creating a check-in', () => {
    const req = { params: { post_id: 'abc' } };
    const res = createResponse();

    controller.createCheckIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(model.getEligibility).not.toHaveBeenCalled();
  });

  test('returns 500 when eligibility lookup fails', () => {
    model.getEligibility.mockImplementation((data, callback) => {
      callback(new Error('database unavailable'));
    });
    const res = createResponse();

    controller.createCheckIn({ params: { post_id: '2' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('returns 404 when the hangout post does not exist', () => {
    model.getEligibility.mockImplementation((data, callback) => {
      callback(null, { rows: [{ status: 'POST_NOT_FOUND' }] });
    });
    const res = createResponse();

    controller.createCheckIn({ params: { post_id: '99' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 403 when the user has not accepted the hangout', () => {
    model.getEligibility.mockImplementation((data, callback) => {
      callback(null, { rows: [{ status: 'NOT_ACCEPTED' }] });
    });
    const res = createResponse();

    controller.createCheckIn({ params: { post_id: '2' } }, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 409 when eligibility says the check-in already exists', () => {
    model.getEligibility.mockImplementation((data, callback) => {
      callback(null, { rows: [{ status: 'ALREADY_CHECKED_IN' }] });
    });
    const res = createResponse();

    controller.createCheckIn({ params: { post_id: '2' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('handles a duplicate caused by a concurrent insert', () => {
    model.getEligibility.mockImplementation((data, callback) => {
      callback(null, { rows: [{ status: 'ELIGIBLE' }] });
    });
    model.insertSingle.mockImplementation((data, callback) => {
      callback({ code: '23505' });
    });
    const res = createResponse();

    controller.createCheckIn({ params: { post_id: '2' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('returns 500 when inserting an eligible check-in fails', () => {
    model.getEligibility.mockImplementation((data, callback) => {
      callback(null, { rows: [{ status: 'ELIGIBLE' }] });
    });
    model.insertSingle.mockImplementation((data, callback) => {
      callback(new Error('insert failed'));
    });
    const res = createResponse();

    controller.createCheckIn({ params: { post_id: '2' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('creates an eligible check-in successfully', () => {
    const checkIn = { id: 10, post_id: 2, user_id: 7 };

    model.getEligibility.mockImplementation((data, callback) => {
      callback(null, { rows: [{ status: 'ELIGIBLE' }] });
    });
    model.insertSingle.mockImplementation((data, callback) => {
      callback(null, { rows: [checkIn] });
    });

    const res = createResponse();

    controller.createCheckIn({ params: { post_id: '2' } }, res);

    expect(model.insertSingle).toHaveBeenCalledWith(
      { post_id: 2, user_id: 7 },
      expect.any(Function),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Checked in successfully.',
      check_in: checkIn,
    });
  });

  test('returns 500 when completed check-ins cannot be read', () => {
    model.selectByUserId.mockImplementation((userId, callback) => {
      callback(new Error('read failed'));
    });
    const res = createResponse();

    controller.readMyCheckIns({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('returns the logged-in users completed check-ins', () => {
    const rows = [{ id: 1, post_id: 2 }];

    model.selectByUserId.mockImplementation((userId, callback) => {
      callback(null, { rows: rows });
    });

    const res = createResponse();

    controller.readMyCheckIns({}, res);

    expect(model.selectByUserId).toHaveBeenCalledWith(7, expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(rows);
  });

  test('returns 500 when eligible hangouts cannot be read', () => {
    model.selectEligibleByUserId.mockImplementation((userId, callback) => {
      callback(new Error('read failed'));
    });

    const res = createResponse();

    controller.readEligibleHangouts({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('returns eligible accepted hangouts for the logged-in user', () => {
    const rows = [{ post_id: 2, title: 'Lunch Hangout' }];

    model.selectEligibleByUserId.mockImplementation((userId, callback) => {
      callback(null, { rows: rows });
    });

    const res = createResponse();

    controller.readEligibleHangouts({}, res);

    expect(model.selectEligibleByUserId).toHaveBeenCalledWith(7, expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(rows);
  });

  test('rejects an invalid post ID when deleting a check-in', () => {
    const res = createResponse();

    controller.deleteCheckIn({ params: { post_id: '0' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(model.deleteSingle).not.toHaveBeenCalled();
  });

  test('returns 500 when deleting a check-in fails', () => {
    model.deleteSingle.mockImplementation((data, callback) => {
      callback(new Error('delete failed'));
    });

    const res = createResponse();

    controller.deleteCheckIn({ params: { post_id: '2' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('returns 404 when the check-in to delete does not exist', () => {
    model.deleteSingle.mockImplementation((data, callback) => {
      callback(null, { rowCount: 0, rows: [] });
    });

    const res = createResponse();

    controller.deleteCheckIn({ params: { post_id: '2' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('deletes the logged-in users check-in successfully', () => {
    const deleted = { id: 4, post_id: 2, user_id: 7 };

    model.deleteSingle.mockImplementation((data, callback) => {
      callback(null, { rowCount: 1, rows: [deleted] });
    });

    const res = createResponse();

    controller.deleteCheckIn({ params: { post_id: '2' } }, res);

    expect(model.deleteSingle).toHaveBeenCalledWith(
      { post_id: 2, user_id: 7 },
      expect.any(Function),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Check-in removed successfully.',
      deleted_check_in: deleted,
    });
  });
});
