const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

describe('Appeal Management Integration Tests', () => {
  let userAId;
  let userBId;
  let userAToken;
  let seededReportId;

  const REPORT_PASSKEY = process.env.REPORT_PASSKEY || 'campuscollab123';

  beforeAll(async () => {
    const userAResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Appeal Tester', 'appeal_tester@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const userBResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Appeal Target', 'appeal_target@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    userAId = userAResult.rows[0].id;
    userBId = userBResult.rows[0].id;

    userAToken = jwt.sign({ userId: userAId }, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h'
    });
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM appeals WHERE user_id IN ($1, $2);`, [userAId, userBId]);
    await pool.query(`DELETE FROM reports WHERE reporter_id = $1 OR reported_user_id = $2;`, [
      userBId,
      userAId
    ]);

    const reportResult = await pool.query(
      `
      INSERT INTO reports (reporter_id, reported_user_id, incident_area, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
      `,
      [userBId, userAId, 'Forum Page', 'Seeded report for appeal integration tests']
    );

    seededReportId = reportResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM appeals WHERE user_id IN ($1, $2);`, [userAId, userBId]);
    await pool.query(`DELETE FROM reports WHERE reporter_id = $1 OR reported_user_id = $2;`, [
      userBId,
      userAId
    ]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2);`, [userAId, userBId]);
    await pool.end();
  });

  describe('POST /appeals', () => {
    test('creates an appeal successfully with a report_id', async () => {
      const response = await request(app)
        .post('/appeals')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          report_id: seededReportId,
          reason: 'I was not the one who did this, integration test'
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.message).toBe('Appeal submitted successfully');
      expect(response.body.appeal).toBeDefined();
      expect(response.body.appeal.report_id).toBe(seededReportId);
      expect(response.body.appeal.status).toBe('PENDING');

      const dbResult = await pool.query(
        `SELECT * FROM appeals WHERE user_id = $1 AND report_id = $2;`,
        [userAId, seededReportId]
      );

      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].reason).toBe('I was not the one who did this, integration test');
    });

    test('creates an appeal successfully without a report_id', async () => {
      const response = await request(app)
        .post('/appeals')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ reason: 'General appeal, not sure which report caused this' });

      expect(response.statusCode).toBe(201);
      expect(response.body.appeal.report_id).toBeNull();

      const dbResult = await pool.query(
        `SELECT * FROM appeals WHERE user_id = $1 AND report_id IS NULL;`,
        [userAId]
      );

      expect(dbResult.rows.length).toBe(1);
    });

    test('rejects request with no auth token', async () => {
      const response = await request(app)
        .post('/appeals')
        .send({ reason: 'No token provided' });

      expect(response.statusCode).toBe(401);
    });

    test('rejects missing reason', async () => {
      const response = await request(app)
        .post('/appeals')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('reason is missing');
    });

    test('rejects whitespace-only reason', async () => {
      const response = await request(app)
        .post('/appeals')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ reason: '   ' });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('reason is missing');
    });

    test('rejects a non-existent report_id', async () => {
      const response = await request(app)
        .post('/appeals')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          report_id: 999999,
          reason: 'Appealing a report that does not exist'
        });

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('Related report not found');
    });
  });

  describe('GET /appeals', () => {
    test('returns all appeals when passkey is correct', async () => {
      await pool.query(
        `INSERT INTO appeals (user_id, report_id, reason) VALUES ($1, $2, $3);`,
        [userAId, null, 'Seeded appeal for readAllAppeals test']
      );

      const response = await request(app).get('/appeals').set('x-report-passkey', REPORT_PASSKEY);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const foundAppeal = response.body.find((appeal) => appeal.user_id === userAId);

      expect(foundAppeal).toBeDefined();
      expect(foundAppeal.status).toBe('PENDING');
    });

    test('rejects when no passkey header is sent', async () => {
      const response = await request(app).get('/appeals');

      expect(response.statusCode).toBe(401);
    });

    test('rejects wrong passkey', async () => {
      const response = await request(app).get('/appeals').set('x-report-passkey', 'wrongpasskey');

      expect(response.statusCode).toBe(403);
    });
  });
});