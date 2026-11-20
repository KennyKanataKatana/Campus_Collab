require('dotenv').config();

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

describe('Comment Management Integration Tests', () => {
  let postOwnerId;
  let commenterId;
  let otherUserId;
  let mutedUserId;

  let commenterToken;
  let otherUserToken;
  let mutedUserToken;

  let locationId;
  let seededPostId;
  let seededCommentId;

  beforeAll(async () => {
    const locationResult = await pool.query(
      `
      INSERT INTO sp_locations (location_name)
      VALUES ('Comment Test Location')
      ON CONFLICT (location_name)
      DO UPDATE SET location_name = EXCLUDED.location_name
      RETURNING id;
      `
    );

    locationId = locationResult.rows[0].id;

    const postOwnerResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Comment Post Owner', 'comment_post_owner@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const commenterResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Comment Tester', 'comment_tester@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const otherUserResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Comment Other User', 'comment_other_user@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const mutedUserResult = await pool.query(
      `
      INSERT INTO users (
        student_name,
        student_email,
        password_hash,
        is_muted,
        muted_reason
      )
      VALUES (
        'Comment Muted User',
        'comment_muted_user@ichat.sp.edu.sg',
        'hashedpassword',
        TRUE,
        'Muted for comment integration test'
      )
      RETURNING id;
      `
    );

    postOwnerId = postOwnerResult.rows[0].id;
    commenterId = commenterResult.rows[0].id;
    otherUserId = otherUserResult.rows[0].id;
    mutedUserId = mutedUserResult.rows[0].id;

    commenterToken = jwt.sign(
      { userId: commenterId },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );

    otherUserToken = jwt.sign(
      { userId: otherUserId },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );

    mutedUserToken = jwt.sign(
      { userId: mutedUserId },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    await pool.query(
      `
      DELETE FROM hangout_post_comments
      WHERE user_id IN ($1, $2, $3, $4);
      `,
      [postOwnerId, commenterId, otherUserId, mutedUserId]
    );

    await pool.query(
      `
      DELETE FROM hangout_posts
      WHERE user_id = $1;
      `,
      [postOwnerId]
    );

    const postResult = await pool.query(
      `
      INSERT INTO hangout_posts (
        user_id,
        title,
        description,
        location_id,
        max_participants,
        current_participants,
        hangout_at
      )
      VALUES (
        $1,
        'Comment Integration Post',
        'Post used for comment integration tests',
        $2,
        5,
        1,
        CURRENT_TIMESTAMP + INTERVAL '2 days'
      )
      RETURNING id;
      `,
      [postOwnerId, locationId]
    );

    seededPostId = postResult.rows[0].id;

    const commentResult = await pool.query(
      `
      INSERT INTO hangout_post_comments (post_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING id;
      `,
      [seededPostId, commenterId, 'Seeded comment for integration tests']
    );

    seededCommentId = commentResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(
      `
      DELETE FROM hangout_post_comments
      WHERE user_id IN ($1, $2, $3, $4);
      `,
      [postOwnerId, commenterId, otherUserId, mutedUserId]
    );

    await pool.query(
      `
      DELETE FROM hangout_posts
      WHERE user_id = $1;
      `,
      [postOwnerId]
    );

    await pool.query(
      `
      DELETE FROM users
      WHERE id IN ($1, $2, $3, $4);
      `,
      [postOwnerId, commenterId, otherUserId, mutedUserId]
    );

    await pool.query(
      `
      DELETE FROM sp_locations
      WHERE id = $1;
      `,
      [locationId]
    );

    await pool.end();
  });

  describe('GET /comments/post/:post_id', () => {
    test('returns comments for a post with student name', async () => {
      const response = await request(app)
        .get(`/comments/post/${seededPostId}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(seededCommentId);
      expect(response.body[0].post_id).toBe(seededPostId);
      expect(response.body[0].user_id).toBe(commenterId);
      expect(response.body[0].content).toBe('Seeded comment for integration tests');
      expect(response.body[0].student_name).toBe('Comment Tester');
    });

    test('returns an empty array when a post has no comments', async () => {
      await pool.query(
        `
        DELETE FROM hangout_post_comments
        WHERE post_id = $1;
        `,
        [seededPostId]
      );

      const response = await request(app)
        .get(`/comments/post/${seededPostId}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('rejects an invalid post id', async () => {
      const response = await request(app)
        .get('/comments/post/not-a-number');

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Invalid post ID.');
    });
  });

  describe('POST /comments/post/:post_id', () => {
    test('creates a comment successfully', async () => {
      const response = await request(app)
        .post(`/comments/post/${seededPostId}`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({
          content: '  New integration test comment  '
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.post_id).toBe(seededPostId);
      expect(response.body.user_id).toBe(commenterId);
      expect(response.body.content).toBe('New integration test comment');

      const dbResult = await pool.query(
        `
        SELECT *
        FROM hangout_post_comments
        WHERE id = $1;
        `,
        [response.body.id]
      );

      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].content).toBe('New integration test comment');
    });

    test('rejects request with no auth token', async () => {
      const response = await request(app)
        .post(`/comments/post/${seededPostId}`)
        .send({
          content: 'No token comment'
        });

      expect(response.statusCode).toBe(401);
    });

    test('rejects an empty comment', async () => {
      const response = await request(app)
        .post(`/comments/post/${seededPostId}`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({
          content: '   '
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Comment cannot be empty.');
    });

    test('rejects a comment longer than 500 characters', async () => {
      const response = await request(app)
        .post(`/comments/post/${seededPostId}`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({
          content: 'a'.repeat(501)
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Comment cannot exceed 500 characters.');
    });

    test('rejects a comment for a post that does not exist', async () => {
      const response = await request(app)
        .post('/comments/post/999999')
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({
          content: 'Comment on missing post'
        });

      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Post not found.');
    });

    test('rejects a muted user', async () => {
      const response = await request(app)
        .post(`/comments/post/${seededPostId}`)
        .set('Authorization', `Bearer ${mutedUserToken}`)
        .send({
          content: 'Muted user comment'
        });

      expect(response.statusCode).toBe(403);
      expect(response.body.error).toBe(
        'You are muted and cannot perform this action right now'
      );
    });
  });

  describe('DELETE /comments/:comment_id', () => {
    test('deletes the logged-in users own comment', async () => {
      const response = await request(app)
        .delete(`/comments/${seededCommentId}`)
        .set('Authorization', `Bearer ${commenterToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Comment deleted successfully.');
      expect(response.body.deletedComment.id).toBe(seededCommentId);

      const dbResult = await pool.query(
        `
        SELECT *
        FROM hangout_post_comments
        WHERE id = $1;
        `,
        [seededCommentId]
      );

      expect(dbResult.rows.length).toBe(0);
    });

    test('rejects request with no auth token', async () => {
      const response = await request(app)
        .delete(`/comments/${seededCommentId}`);

      expect(response.statusCode).toBe(401);
    });

    test('rejects deleting another users comment', async () => {
      const response = await request(app)
        .delete(`/comments/${seededCommentId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.statusCode).toBe(403);
      expect(response.body.error).toBe(
        'You can only delete your own comments.'
      );
    });

    test('returns 404 when the comment does not exist', async () => {
      const response = await request(app)
        .delete('/comments/999999')
        .set('Authorization', `Bearer ${commenterToken}`);

      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Comment not found.');
    });

    test('rejects an invalid comment id', async () => {
      const response = await request(app)
        .delete('/comments/not-a-number')
        .set('Authorization', `Bearer ${commenterToken}`);

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Invalid comment ID.');
    });
  });
});