jest.mock('../../src/models/db', () => ({
  query: jest.fn()
}));

const pool = require('../../src/models/db');
const ReportModel = require('../../src/models/ReportsModel');

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