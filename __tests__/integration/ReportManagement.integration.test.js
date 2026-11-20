const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

describe('Report Management Integration Tests', () => {
  let reporterId;
  let reportedUserId;
  let mutedReporterId;
  let reporterToken;
  let mutedReporterToken;

  const REPORT_PASSKEY = process.env.REPORT_PASSKEY || 'campuscollab123';

  beforeAll(async () => {
    const reporterResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Report Tester', 'report_tester@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const reportedResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Reported Student', 'reported_student@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const mutedReporterResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Muted Reporter', 'muted_reporter@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    reporterId = reporterResult.rows[0].id;
    reportedUserId = reportedResult.rows[0].id;
    mutedReporterId = mutedReporterResult.rows[0].id;

    reporterToken = jwt.sign({ userId: reporterId }, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h'
    });

    mutedReporterToken = jwt.sign({ userId: mutedReporterId }, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h'
    });
  });

  beforeEach(async () => {
    await pool.query(
      `
      DELETE FROM reports
      WHERE reporter_id IN ($1, $2)
         OR reported_user_id = $3;
      `,
      [reporterId, mutedReporterId, reportedUserId]
    );

    await pool.query(
      `
      UPDATE users
      SET is_muted = FALSE,
          muted_at = NULL,
          mute_until = NULL,
          muted_reason = NULL
      WHERE id IN ($1, $2, $3);
      `,
      [reporterId, reportedUserId, mutedReporterId]
    );
  });

  afterAll(async () => {
    await pool.query(
      `
      DELETE FROM reports
      WHERE reporter_id IN ($1, $2)
         OR reported_user_id = $3;
      `,
      [reporterId, mutedReporterId, reportedUserId]
    );

    await pool.query(
      `
      DELETE FROM users
      WHERE id IN ($1, $2, $3);
      `,
      [reporterId, reportedUserId, mutedReporterId]
    );

    await pool.end();
  });

  describe('POST /reports', () => {
    test('creates a report successfully', async () => {
      const response = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          reported_student_name: 'Reported Student',
          incident_area: 'Forum Page',
          reason: 'Spam - integration test',
          proof_image_url: 'https://example.com/proof.png'
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.message).toBe('User reported successfully');
      expect(response.body.report).toBeDefined();

      const dbResult = await pool.query(
        `
        SELECT *
        FROM reports
        WHERE reporter_id = $1
          AND reported_user_id = $2
          AND incident_area = $3;
        `,
        [reporterId, reportedUserId, 'Forum Page']
      );

      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].reason).toBe('Spam - integration test');
      expect(dbResult.rows[0].proof_image_url).toBe('https://example.com/proof.png');
    });

    test('creates a report successfully without a proof image url', async () => {
      const response = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          reported_student_name: 'Reported Student',
          incident_area: 'Post Page',
          reason: 'No proof link for this one'
        });

      expect(response.statusCode).toBe(201);

      const dbResult = await pool.query(
        `
        SELECT proof_image_url
        FROM reports
        WHERE reporter_id = $1 AND reported_user_id = $2;
        `,
        [reporterId, reportedUserId]
      );

      expect(dbResult.rows[0].proof_image_url).toBeNull();
    });

    test('rejects request with no auth token', async () => {
      const response = await request(app).post('/reports').send({
        reported_student_name: 'Reported Student',
        incident_area: 'Forum Page',
        reason: 'No token provided'
      });

      expect(response.statusCode).toBe(401);
    });

    test('rejects missing required fields', async () => {
      const response = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          reported_student_name: 'Reported Student',
          incident_area: 'Forum Page'
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe(
        'reported_student_name, incident_area or reason is missing'
      );
    });

    test('rejects self-report', async () => {
      const response = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          reported_student_name: 'Report Tester',
          incident_area: 'General',
          reason: 'Trying to report self'
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('You cannot report yourself');
    });

    test('rejects unknown reported user', async () => {
      const response = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          reported_student_name: 'User Does Not Exist',
          incident_area: 'Forum Page',
          reason: 'Fake report target'
        });

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('Reported user not found');
    });

    test('blocks a muted user from reporting', async () => {
      await pool.query(
        `
        UPDATE users
        SET is_muted = TRUE,
            muted_at = CURRENT_TIMESTAMP,
            mute_until = CURRENT_TIMESTAMP + INTERVAL '10 minutes',
            muted_reason = 'Muted by admin'
        WHERE id = $1;
        `,
        [mutedReporterId]
      );

      const response = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${mutedReporterToken}`)
        .send({
          reported_student_name: 'Reported Student',
          incident_area: 'Post Page',
          reason: 'Muted user should not be allowed to report'
        });

      expect(response.statusCode).toBe(403);
      expect(response.body.error).toMatch(/muted|cannot perform this action/i);

      const dbResult = await pool.query(
        `
        SELECT *
        FROM reports
        WHERE reporter_id = $1 AND reported_user_id = $2;
        `,
        [mutedReporterId, reportedUserId]
      );

      expect(dbResult.rows.length).toBe(0);
    });
  });

  describe('GET /reports', () => {
    test('returns all reports when passkey is correct', async () => {
      await pool.query(
        `
        INSERT INTO reports (reporter_id, reported_user_id, incident_area, reason, proof_image_url)
        VALUES ($1, $2, $3, $4, $5);
        `,
        [reporterId, reportedUserId, 'Forum Page', 'Seeded report for readAllReports test', null]
      );

      const response = await request(app).get('/reports').set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const foundReport = response.body.find(
        (report) => report.reporter_id === reporterId && report.reported_user_id === reportedUserId
      );

      expect(foundReport).toBeDefined();
    });

    test('rejects when no passkey header is sent', async () => {
      const response = await request(app).get('/reports');

      expect(response.statusCode).toBe(401);
    });

    test('rejects wrong passkey', async () => {
      const response = await request(app)
        .get('/reports')
        .set('x-report-passkey', 'wrongpasskey');

      expect(response.statusCode).toBe(403);
      expect(response.body.message).toBe('Wrong passkey. Reports are still hidden.');
    });
  });

  describe('GET /reports/reporter/:reporter_id', () => {
    test('returns reports filtered by reporter id', async () => {
      await pool.query(
        `
        INSERT INTO reports (reporter_id, reported_user_id, incident_area, reason)
        VALUES ($1, $2, $3, $4);
        `,
        [reporterId, reportedUserId, 'Forum Page', 'Filtered by reporter id']
      );

      const response = await request(app)
        .get(`/reports/reporter/${reporterId}`)
        .set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(200);
      expect(response.body.some((r) => r.reporter_id === reporterId)).toBe(true);
    });

    test('returns 404 when reporter has no reports', async () => {
      const response = await request(app)
        .get(`/reports/reporter/${reporterId}`)
        .set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('No reports found for this reporter');
    });
  });

  describe('GET /reports/reported/:reported_user_id', () => {
    test('returns reports filtered by reported user id', async () => {
      await pool.query(
        `
        INSERT INTO reports (reporter_id, reported_user_id, incident_area, reason)
        VALUES ($1, $2, $3, $4);
        `,
        [reporterId, reportedUserId, 'Forum Page', 'Filtered by reported user id']
      );

      const response = await request(app)
        .get(`/reports/reported/${reportedUserId}`)
        .set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(200);
      expect(response.body.some((r) => r.reported_user_id === reportedUserId)).toBe(true);
    });

    test('returns 404 when reported user has no reports', async () => {
      const response = await request(app)
        .get(`/reports/reported/${reportedUserId}`)
        .set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('No reports found for this reported user');
    });
  });

  describe('GET /reports/my-received-reports', () => {
    test("returns the caller's received reports", async () => {
      await pool.query(
        `
        INSERT INTO reports (reporter_id, reported_user_id, incident_area, reason)
        VALUES ($1, $2, $3, $4);
        `,
        [reporterId, reportedUserId, 'Forum Page', 'Seeded for my-received-reports test']
      );

      const reportedUserToken = jwt.sign(
        { userId: reportedUserId },
        process.env.JWT_SECRET_KEY,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/reports/my-received-reports')
        .set('Authorization', `Bearer ${reportedUserToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.some((r) => r.reported_user_id === reportedUserId)).toBe(true);
    });

    test('rejects when no auth token is provided', async () => {
      const response = await request(app).get('/reports/my-received-reports');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /reports/users', () => {
    test('returns reportable users without requiring auth or passkey', async () => {
      const response = await request(app).get('/reports/users');

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((u) => u.id === reportedUserId)).toBe(true);
    });
  });

  describe('PATCH /reports/mute/:reported_user_id', () => {
    test('mutes a user successfully', async () => {
      const response = await request(app)
        .patch(`/reports/mute/${reportedUserId}`)
        .set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('User muted successfully');
      expect(response.body.user.id).toBe(reportedUserId);
      expect(response.body.user.is_muted).toBe(true);

      const dbResult = await pool.query(
        `SELECT is_muted, muted_reason FROM users WHERE id = $1;`,
        [reportedUserId]
      );

      expect(dbResult.rows[0].is_muted).toBe(true);
      expect(dbResult.rows[0].muted_reason).toBe('Muted by admin');
    });

    test('returns 404 for a non-existent user id', async () => {
      const response = await request(app)
        .patch('/reports/mute/999999')
        .set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('Reported user not found');
    });
  });

  describe('GET /reports/muted-users', () => {
    test('returns muted users', async () => {
      await pool.query(
        `
        UPDATE users
        SET is_muted = TRUE, muted_at = CURRENT_TIMESTAMP, muted_reason = 'Muted by admin'
        WHERE id = $1;
        `,
        [reportedUserId]
      );

      const response = await request(app)
        .get('/reports/muted-users')
        .set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(200);

      const foundMutedUser = response.body.find((user) => user.id === reportedUserId);

      expect(foundMutedUser).toBeDefined();
      expect(foundMutedUser.is_muted).toBe(true);
    });
  });

  describe('PATCH /reports/unmute/:user_id', () => {
    test('unmutes a user successfully', async () => {
      await pool.query(
        `
        UPDATE users
        SET is_muted = TRUE, muted_at = CURRENT_TIMESTAMP, muted_reason = 'Muted by admin'
        WHERE id = $1;
        `,
        [reportedUserId]
      );

      const response = await request(app)
        .patch(`/reports/unmute/${reportedUserId}`)
        .set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('User unmuted successfully');
      expect(response.body.user.is_muted).toBe(false);

      const dbResult = await pool.query(
        `SELECT is_muted, muted_reason FROM users WHERE id = $1;`,
        [reportedUserId]
      );

      expect(dbResult.rows[0].is_muted).toBe(false);
      expect(dbResult.rows[0].muted_reason).toBeNull();
    });

    test('returns 404 for a user that is not muted or does not exist', async () => {
      const response = await request(app)
        .patch('/reports/unmute/999999')
        .set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('Muted user not found');
    });
  });
});