const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

describe('User Management Integration Tests', () => {
  let userId;
  let otherUserId;
  let token;

  beforeAll(async () => {
    const userResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash, bio)
      VALUES ('User Route Tester', 'user_route_tester@ichat.sp.edu.sg', 'hashedpassword', 'A test bio')
      RETURNING id;
      `
    );

    const otherUserResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('User Route Other', 'user_route_other@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    userId = userResult.rows[0].id;
    otherUserId = otherUserResult.rows[0].id;

    token = jwt.sign({ userId }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2);`, [userId, otherUserId]);
  });

  describe('GET /users', () => {
    test('rejects request with no auth token', async () => {
      const response = await request(app).get('/users');

      expect(response.statusCode).toBe(401);
    });

    test('rejects request with an invalid token', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer not-a-real-token');

      expect(response.statusCode).toBe(401);
    });

    test('returns all users for an authenticated request', async () => {
      const response = await request(app).get('/users').set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((u) => u.id === userId)).toBe(true);
      expect(response.body.some((u) => u.id === otherUserId)).toBe(true);
    });
  });

  describe('GET /users/:id', () => {
    test('rejects request with no auth token', async () => {
      const response = await request(app).get(`/users/${userId}`);

      expect(response.statusCode).toBe(401);
    });

    test('returns the user for a valid id', async () => {
      const response = await request(app)
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(userId);
      expect(response.body.student_name).toBe('User Route Tester');
      expect(response.body.student_email).toBe('user_route_tester@ichat.sp.edu.sg');
      expect(response.body.bio).toBe('A test bio');
      expect(response.body.password_hash).toBeUndefined();
    });
  });
});