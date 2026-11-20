const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');
const checkInModel = require('../../src/models/CheckInModel');

describe('Check-In routes', () => {
  let userId;
  let hostId;
  let locationId;
  let acceptedPostId;
  let unacceptedPostId;
  let token;

  beforeAll(async () => {
    const users = await pool.query(`
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES
        ('CheckIn User', 'checkin.route.user@ichat.sp.edu.sg', 'hash'),
        ('CheckIn Host', 'checkin.route.host@ichat.sp.edu.sg', 'hash')
      RETURNING id;
    `);

    userId = users.rows[0].id;
    hostId = users.rows[1].id;

    const location = await pool.query(`
      INSERT INTO sp_locations (location_name)
      VALUES ('CheckIn Integration Location')
      RETURNING id;
    `);

    locationId = location.rows[0].id;

    const posts = await pool.query(
      `
        INSERT INTO hangout_posts
          (user_id, title, description, location_id, max_participants)
        VALUES
          ($1, 'Accepted Integration Hangout', 'Accepted test post', $2, 8),
          ($1, 'Unaccepted Integration Hangout', 'Unaccepted test post', $2, 6)
        RETURNING id;
      `,
      [hostId, locationId],
    );

    acceptedPostId = posts.rows[0].id;
    unacceptedPostId = posts.rows[1].id;

    await pool.query(
      `
        INSERT INTO hangout_acceptances (post_id, user_id)
        VALUES ($1, $2);
      `,
      [acceptedPostId, userId],
    );

    token = jwt.sign({ userId: userId }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id IN ($1, $2);', [userId, hostId]);
    await pool.query('DELETE FROM sp_locations WHERE id = $1;', [locationId]);
    await pool.end();
  });

  test('rejects check-in data without a JWT', async () => {
    const response = await request(app).get('/checkin/me');

    expect(response.statusCode).toBe(401);
  });

  test('lists accepted hangouts that are eligible for check-in', async () => {
    const response = await request(app)
      .get('/checkin/eligible')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          post_id: acceptedPostId,
          title: 'Accepted Integration Hangout',
          host_name: 'CheckIn Host',
          location_name: 'CheckIn Integration Location',
        }),
      ]),
    );
  });

  test('returns 500 when eligible hangouts cannot be read', async () => {
    jest.spyOn(checkInModel, 'selectEligibleByUserId').mockImplementation((user, callback) => {
      callback(new Error('forced eligible failure'));
    });

    const response = await request(app)
      .get('/checkin/eligible')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe('Internal server error.');
  });

  test('rejects an invalid check-in post ID', async () => {
    const response = await request(app)
      .post('/checkin/not-a-number')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(400);
  });

  test('returns 500 when check-in eligibility cannot be read', async () => {
    jest.spyOn(checkInModel, 'getEligibility').mockImplementation((data, callback) => {
      callback(new Error('forced eligibility failure'));
    });

    const response = await request(app)
      .post(`/checkin/${acceptedPostId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe('Internal server error.');
  });

  test('returns 404 for a missing hangout post', async () => {
    const response = await request(app)
      .post('/checkin/99999999')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(404);
  });

  test('prevents check-in to a hangout the user did not accept', async () => {
    const response = await request(app)
      .post(`/checkin/${unacceptedPostId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toMatch(/only check in/i);
  });

  test('handles a duplicate detected while inserting', async () => {
    jest
      .spyOn(checkInModel, 'getEligibility')
      .mockImplementation((data, callback) => callback(null, { rows: [{ status: 'ELIGIBLE' }] }));
    jest
      .spyOn(checkInModel, 'insertSingle')
      .mockImplementation((data, callback) => callback({ code: '23505' }));

    const response = await request(app)
      .post(`/checkin/${acceptedPostId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toMatch(/already checked in/i);
  });

  test('returns 500 when an eligible check-in cannot be inserted', async () => {
    jest
      .spyOn(checkInModel, 'getEligibility')
      .mockImplementation((data, callback) => callback(null, { rows: [{ status: 'ELIGIBLE' }] }));
    jest
      .spyOn(checkInModel, 'insertSingle')
      .mockImplementation((data, callback) => callback(new Error('forced insert failure')));

    const response = await request(app)
      .post(`/checkin/${acceptedPostId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe('Internal server error.');
  });

  test('creates a check-in for an accepted hangout', async () => {
    const response = await request(app)
      .post(`/checkin/${acceptedPostId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(201);
    expect(response.body.check_in).toEqual(
      expect.objectContaining({
        post_id: acceptedPostId,
        user_id: userId,
      }),
    );

    const stored = await pool.query(
      `
        SELECT * FROM hangout_check_ins
        WHERE post_id = $1 AND user_id = $2;
      `,
      [acceptedPostId, userId],
    );

    expect(stored.rowCount).toBe(1);
  });

  test('prevents a duplicate check-in', async () => {
    const response = await request(app)
      .post(`/checkin/${acceptedPostId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(409);
  });

  test('returns 500 when completed check-ins cannot be read', async () => {
    jest.spyOn(checkInModel, 'selectByUserId').mockImplementation((user, callback) => {
      callback(new Error('forced completed failure'));
    });

    const response = await request(app).get('/checkin/me').set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe('Internal server error.');
  });

  test('lists completed check-ins with real hangout details', async () => {
    const response = await request(app).get('/checkin/me').set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        post_id: acceptedPostId,
        title: 'Accepted Integration Hangout',
        host_name: 'CheckIn Host',
        location_name: 'CheckIn Integration Location',
        max_participants: 8,
      }),
    );
  });

  test('rejects an invalid post ID when cancelling a check-in', async () => {
    const response = await request(app)
      .delete('/checkin/0')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(400);
  });

  test('returns 500 when a check-in cannot be deleted', async () => {
    jest.spyOn(checkInModel, 'deleteSingle').mockImplementation((data, callback) => {
      callback(new Error('forced delete failure'));
    });

    const response = await request(app)
      .delete(`/checkin/${acceptedPostId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe('Internal server error.');
  });

  test('returns 404 when the check-in to cancel does not exist', async () => {
    const response = await request(app)
      .delete(`/checkin/${unacceptedPostId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Check-in not found.');
  });

  test('cancels only the logged-in users matching check-in', async () => {
    const response = await request(app)
      .delete(`/checkin/${acceptedPostId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.deleted_check_in.post_id).toBe(acceptedPostId);

    const stored = await pool.query(
      `
        SELECT * FROM hangout_check_ins
        WHERE post_id = $1 AND user_id = $2;
      `,
      [acceptedPostId, userId],
    );

    expect(stored.rowCount).toBe(0);
  });
});
