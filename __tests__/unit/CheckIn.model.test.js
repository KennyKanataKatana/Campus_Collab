jest.mock('../../src/models/db', () => ({ query: jest.fn() }));

const pool = require('../../src/models/db');
const model = require('../../src/models/CheckInModel');

describe('CheckIn model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('checks post, acceptance and duplicate status using the owner values', () => {
    const callback = jest.fn();

    model.getEligibility({ post_id: 8, user_id: 3 }, callback);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("THEN 'NOT_ACCEPTED'"),
      [8, 3],
      callback,
    );
    expect(pool.query.mock.calls[0][0]).toContain('hangout_check_ins');
  });

  test('inserts and returns a PostgreSQL check-in row', () => {
    const callback = jest.fn();

    model.insertSingle({ post_id: 4, user_id: 2 }, callback);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO hangout_check_ins'),
      [4, 2],
      callback,
    );
    expect(pool.query.mock.calls[0][0]).toContain('RETURNING');
  });

  test('reads detailed completed and eligible hangouts for one user', () => {
    const completedCallback = jest.fn();
    const eligibleCallback = jest.fn();

    model.selectByUserId(5, completedCallback);
    model.selectEligibleByUserId(5, eligibleCallback);

    expect(pool.query.mock.calls[0][0]).toContain('host_name');
    expect(pool.query.mock.calls[0][0]).toContain('location_name');
    expect(pool.query.mock.calls[0][1]).toEqual([5]);
    expect(pool.query.mock.calls[1][0]).toContain('hci.id IS NULL');
    expect(pool.query.mock.calls[1][1]).toEqual([5]);
  });

  test('deletes only the logged-in users matching check-in', () => {
    const callback = jest.fn();

    model.deleteSingle({ post_id: 9, user_id: 6 }, callback);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM hangout_check_ins'),
      [9, 6],
      callback,
    );
    expect(pool.query.mock.calls[0][0]).toContain('RETURNING');
  });
});
