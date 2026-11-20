jest.mock('../../src/models/ProfileModel', () => ({
  readMyProfile: jest.fn(),
}));

const model = require('../../src/models/ProfileModel');
const controller = require('../../src/controllers/ProfileController');

function createResponse(userId = 7) {
  const res = {
    locals: { userId: userId },
    status: jest.fn(),
    json: jest.fn(),
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('Profile controller', () => {
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('returns 500 when the profile query fails', () => {
    model.readMyProfile.mockImplementation((data, callback) => {
      callback(new Error('read failed'));
    });

    const res = createResponse();

    controller.readMyProfile({}, res);

    expect(model.readMyProfile).toHaveBeenCalledWith({ user_id: 7 }, expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal server error',
    });
  });

  test('returns 404 when the logged-in profile does not exist', () => {
    model.readMyProfile.mockImplementation((data, callback) => {
      callback(null, { rows: [] });
    });

    const res = createResponse();

    controller.readMyProfile({}, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Profile not found',
    });
  });

  test('returns the logged-in users profile', () => {
    const profile = {
      id: 7,
      student_name: 'Profile User',
      check_ins_completed: '2',
    };

    model.readMyProfile.mockImplementation((data, callback) => {
      callback(null, { rows: [profile] });
    });

    const res = createResponse();

    controller.readMyProfile({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(profile);
  });
});
