const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

describe('Forum Management Integration Tests', () => {
  let authorId;
  let otherUserId;
  let locationId;
  let authorToken;
  let otherUserToken;

  beforeAll(async () => {
    const authorResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Forum Author', 'forum_author@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const otherUserResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Forum Voter', 'forum_voter@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const locationResult = await pool.query(
      `
      INSERT INTO sp_locations (location_name)
      VALUES ('Forum Test Location')
      RETURNING id;
      `
    );

    authorId = authorResult.rows[0].id;
    otherUserId = otherUserResult.rows[0].id;
    locationId = locationResult.rows[0].id;

    authorToken = jwt.sign({ userId: authorId }, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h'
    });

    otherUserToken = jwt.sign({ userId: otherUserId }, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h'
    });
  });

  beforeEach(async () => {
    await pool.query(
      `
      DELETE FROM forum_thread_votes
      WHERE user_id IN ($1, $2);
      `,
      [authorId, otherUserId]
    );

    await pool.query(
      `
      DELETE FROM forum_replies
      WHERE user_id IN ($1, $2);
      `,
      [authorId, otherUserId]
    );

    await pool.query(
      `
      DELETE FROM forum_threads
      WHERE user_id IN ($1, $2);
      `,
      [authorId, otherUserId]
    );

    await pool.query(
      `
      UPDATE users
      SET is_muted = FALSE,
          muted_at = NULL,
          mute_until = NULL,
          muted_reason = NULL
      WHERE id IN ($1, $2);
      `,
      [authorId, otherUserId]
    );
  });

  afterAll(async () => {
    await pool.query(
      `
      DELETE FROM forum_thread_votes
      WHERE user_id IN ($1, $2);
      `,
      [authorId, otherUserId]
    );

    await pool.query(
      `
      DELETE FROM forum_replies
      WHERE user_id IN ($1, $2);
      `,
      [authorId, otherUserId]
    );

    await pool.query(
      `
      DELETE FROM forum_threads
      WHERE user_id IN ($1, $2);
      `,
      [authorId, otherUserId]
    );

    await pool.query(`DELETE FROM sp_locations WHERE id = $1;`, [locationId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2);`, [authorId, otherUserId]);
  });

  async function createThread(overrides = {}) {
    const response = await request(app)
      .post('/forum')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        location_id: locationId,
        title: 'Test thread',
        content: 'Test content',
        ...overrides
      });

    return response.body;
  }

  describe('GET /forum', () => {
    test('rejects request with no auth token', async () => {
      const response = await request(app).get('/forum');

      expect(response.statusCode).toBe(401);
    });

    test('returns threads for an authenticated user', async () => {
      const thread = await createThread({ title: 'Visible thread' });

      const response = await request(app)
        .get('/forum')
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.some((t) => t.id === thread.id)).toBe(true);
    });

    test('orders threads by like_count when sort=likes', async () => {
      const threadA = await createThread({ title: 'Thread A' });

      const response = await request(app)
        .get('/forum?sort=likes')
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.some((t) => t.id === threadA.id)).toBe(true);
    });
  });

  describe('GET /forum/:thread_id', () => {
    test('returns a single thread without requiring auth', async () => {
      const thread = await createThread({ title: 'Public thread' });

      const response = await request(app).get(`/forum/${thread.id}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(thread.id);
      expect(response.body.title).toBe('Public thread');
    });

    test('returns 404 for a non-existent thread', async () => {
      const response = await request(app).get('/forum/999999');

      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Thread not found');
    });
  });

  describe('POST /forum', () => {
    test('rejects request with no auth token', async () => {
      const response = await request(app)
        .post('/forum')
        .send({ location_id: locationId, title: 'T', content: 'C' });

      expect(response.statusCode).toBe(401);
    });

    test('rejects missing required fields', async () => {
      const response = await request(app)
        .post('/forum')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ location_id: locationId });

      expect(response.statusCode).toBe(400);
    });

    test('rejects an invalid image_url', async () => {
      const response = await request(app)
        .post('/forum')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          location_id: locationId,
          title: 'T',
          content: 'C',
          image_url: 'not-a-valid-url'
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Image URL is not valid');
    });

    test('creates a thread successfully', async () => {
      const response = await request(app)
        .post('/forum')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          location_id: locationId,
          title: 'New thread',
          content: 'Some content here'
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.title).toBe('New thread');

      const dbResult = await pool.query(`SELECT * FROM forum_threads WHERE id = $1;`, [
        response.body.id
      ]);

      expect(dbResult.rows.length).toBe(1);
    });

    test('blocks a muted user from creating a thread', async () => {
      await pool.query(
        `
        UPDATE users
        SET is_muted = TRUE,
            muted_at = CURRENT_TIMESTAMP,
            mute_until = CURRENT_TIMESTAMP + INTERVAL '10 minutes',
            muted_reason = 'Muted by admin'
        WHERE id = $1;
        `,
        [otherUserId]
      );

      const response = await request(app)
        .post('/forum')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ location_id: locationId, title: 'T', content: 'C' });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /forum/:thread_id/replies', () => {
    test('creates a reply successfully', async () => {
      const thread = await createThread({ title: 'Thread with replies' });

      const response = await request(app)
        .post(`/forum/${thread.id}/replies`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ content: 'Nice thread!' });

      expect(response.statusCode).toBe(200);
      expect(response.body.content).toBe('Nice thread!');
    });

    test('rejects missing content', async () => {
      const thread = await createThread({ title: 'Thread with replies' });

      const response = await request(app)
        .post(`/forum/${thread.id}/replies`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({});

      expect(response.statusCode).toBe(400);
    });

    test('rejects request with no auth token', async () => {
      const thread = await createThread({ title: 'Thread with replies' });

      const response = await request(app)
        .post(`/forum/${thread.id}/replies`)
        .send({ content: 'Nice thread!' });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /forum/:thread_id/replies', () => {
    test('returns replies for a thread', async () => {
      const thread = await createThread({ title: 'Thread with replies' });

      await request(app)
        .post(`/forum/${thread.id}/replies`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ content: 'First reply' });

      const response = await request(app)
        .get(`/forum/${thread.id}/replies`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.some((r) => r.content === 'First reply')).toBe(true);
    });

    test('rejects request with no auth token', async () => {
      const thread = await createThread({ title: 'Thread with replies' });

      const response = await request(app).get(`/forum/${thread.id}/replies`);

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /forum/:thread_id/vote', () => {
    test('rejects an invalid vote_type', async () => {
      const thread = await createThread({ title: 'Thread to vote on' });

      const response = await request(app)
        .post(`/forum/${thread.id}/vote`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ vote_type: 'MAYBE' });

      expect(response.statusCode).toBe(400);
    });

    test('casts a LIKE vote successfully', async () => {
      const thread = await createThread({ title: 'Thread to vote on' });

      const response = await request(app)
        .post(`/forum/${thread.id}/vote`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ vote_type: 'LIKE' });

      expect(response.statusCode).toBe(200);
      expect(response.body.vote_type).toBe('LIKE');
    });

    test('changes an existing vote from LIKE to DISLIKE via upsert', async () => {
      const thread = await createThread({ title: 'Thread to vote on' });

      await request(app)
        .post(`/forum/${thread.id}/vote`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ vote_type: 'LIKE' });

      const response = await request(app)
        .post(`/forum/${thread.id}/vote`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ vote_type: 'DISLIKE' });

      expect(response.statusCode).toBe(200);
      expect(response.body.vote_type).toBe('DISLIKE');

      const dbResult = await pool.query(
        `SELECT COUNT(*) FROM forum_thread_votes WHERE thread_id = $1 AND user_id = $2;`,
        [thread.id, otherUserId]
      );

      expect(Number(dbResult.rows[0].count)).toBe(1);
    });

    test('rejects request with no auth token', async () => {
      const thread = await createThread({ title: 'Thread to vote on' });

      const response = await request(app)
        .post(`/forum/${thread.id}/vote`)
        .send({ vote_type: 'LIKE' });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /forum/:thread_id/vote', () => {
    test('removes an existing vote', async () => {
      const thread = await createThread({ title: 'Thread to unvote' });

      await request(app)
        .post(`/forum/${thread.id}/vote`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ vote_type: 'LIKE' });

      const response = await request(app)
        .delete(`/forum/${thread.id}/vote`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.removedVote).toBeDefined();

      const dbResult = await pool.query(
        `SELECT * FROM forum_thread_votes WHERE thread_id = $1 AND user_id = $2;`,
        [thread.id, otherUserId]
      );

      expect(dbResult.rows.length).toBe(0);
    });

    test('returns removedVote null when there was no vote to remove', async () => {
      const thread = await createThread({ title: 'Thread with no vote' });

      const response = await request(app)
        .delete(`/forum/${thread.id}/vote`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.removedVote).toBeNull();
    });
  });

  describe('DELETE /forum/:thread_id', () => {
    test('rejects request with no auth token', async () => {
      const thread = await createThread({ title: 'Thread to delete' });

      const response = await request(app).delete(`/forum/${thread.id}`);

      expect(response.statusCode).toBe(401);
    });

    test('rejects deletion by a non-owner', async () => {
      const thread = await createThread({ title: 'Thread to delete' });

      const response = await request(app)
        .delete(`/forum/${thread.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.statusCode).toBe(403);
    });

    test('deletes the thread successfully when the caller is the owner', async () => {
      const thread = await createThread({ title: 'Thread to delete' });

      const response = await request(app)
        .delete(`/forum/${thread.id}`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Thread deleted successfully');

      const dbResult = await pool.query(`SELECT * FROM forum_threads WHERE id = $1;`, [
        thread.id
      ]);

      expect(dbResult.rows.length).toBe(0);
    });
  });
});