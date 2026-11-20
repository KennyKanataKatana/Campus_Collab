const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');
const profileModel = require('../../src/models/ProfileModel');

describe('Profile routes', () => {
  let userId;
  let hostId;
  let locationId;
  let token;

  beforeAll(async () => {
    const users = await pool.query(`
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES
        ('Profile Route User', 'profile.route.user@ichat.sp.edu.sg', 'hash'),
        ('Profile Route Host', 'profile.route.host@ichat.sp.edu.sg', 'hash')
      RETURNING id;
    `);

    userId = users.rows[0].id;
    hostId = users.rows[1].id;

    const location = await pool.query(`
      INSERT INTO sp_locations (location_name)
      VALUES ('Profile Route Location')
      RETURNING id;
    `);

    locationId = location.rows[0].id;

    const posts = await pool.query(
      `
        INSERT INTO hangout_posts
          (user_id, title, description, location_id, max_participants)
        VALUES
          ($1, 'Accepted Profile Hangout', 'Profile acceptance fixture', $2, 10),
          ($3, 'Users Own Profile Post', 'Profile post count fixture', $2, 5)
        RETURNING id;
      `,
      [hostId, locationId, userId],
    );

    const acceptedPostId = posts.rows[0].id;

    await pool.query(
      `
        INSERT INTO hangout_acceptances (post_id, user_id)
        VALUES ($1, $2);
      `,
      [acceptedPostId, userId],
    );

    await pool.query(
      `
        INSERT INTO hangout_check_ins (post_id, user_id)
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

  test('protects the profile endpoint', async () => {
    const response = await request(app).get('/profile/me');

    expect(response.statusCode).toBe(401);
  });

  test('returns 404 when the JWT user does not exist', async () => {
    const missingToken = jwt.sign({ userId: 99999999 }, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h',
    });

    const response = await request(app)
      .get('/profile/me')
      .set('Authorization', `Bearer ${missingToken}`);

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Profile not found');
  });

  test('returns 500 when the profile model fails', async () => {
    jest.spyOn(profileModel, 'readMyProfile').mockImplementation((data, callback) => {
      callback(new Error('forced profile failure'));
    });

    const response = await request(app).get('/profile/me').set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe('Internal server error');
  });

  test('returns the logged-in users complete profile activity', async () => {
    const response = await request(app).get('/profile/me').set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: userId,
        student_name: 'Profile Route User',
        posts_created: '1',
        hangouts_joined: '1',
        check_ins_completed: '1',
      }),
    );
  });
});
