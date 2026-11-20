jest.mock('../../src/models/db', () => ({ query: jest.fn() }));

const pool = require('../../src/models/db');
const profileModel = require('../../src/models/ProfileModel');

describe('Profile model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('reads the full activity dashboard for the requested user', () => {
    const callback = jest.fn();

    profileModel.readMyProfile({ user_id: 6 }, callback);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('FROM users'), [6], callback);

    const query = pool.query.mock.calls[0][0];

    expect(query).toContain('AS posts_created');
    expect(query).toContain('AS hangouts_joined');
    expect(query).toContain('AS bookmarks_saved');
    expect(query).toContain('AS friends_count');
    expect(query).toContain('AS check_ins_completed');
    expect(query).toContain('hangout_check_ins');
    expect(query).toContain('AS favourite_location');
  });
});
