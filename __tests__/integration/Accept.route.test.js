require('dotenv').config();

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

describe('Accept Hangout Integration Tests', () => {
  let hostAId;
  let hostBId;
  let participantId;
  let extraParticipantId;

  let hostAToken;
  let participantToken;
  let extraParticipantToken;

  let locationId;
  let postAId;
  let postBId;
  let fullPostId;

  beforeAll(async () => {
    const locationResult = await pool.query(
      `
      INSERT INTO sp_locations (location_name)
      VALUES ('Accept Test Location')
      ON CONFLICT (location_name)
      DO UPDATE SET location_name = EXCLUDED.location_name
      RETURNING id;
      `
    );

    locationId = locationResult.rows[0].id;

    const hostAResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Accept Host A', 'accept_host_a@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const hostBResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Accept Host B', 'accept_host_b@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const participantResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Accept Participant', 'accept_participant@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    const extraParticipantResult = await pool.query(
      `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ('Accept Extra Participant', 'accept_extra_participant@ichat.sp.edu.sg', 'hashedpassword')
      RETURNING id;
      `
    );

    hostAId = hostAResult.rows[0].id;
    hostBId = hostBResult.rows[0].id;
    participantId = participantResult.rows[0].id;
    extraParticipantId = extraParticipantResult.rows[0].id;

    hostAToken = jwt.sign(
      { userId: hostAId },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );

    participantToken = jwt.sign(
      { userId: participantId },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );

    extraParticipantToken = jwt.sign(
      { userId: extraParticipantId },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    await pool.query(
      `
      DELETE FROM hangout_check_ins
      WHERE user_id IN ($1, $2, $3, $4);
      `,
      [hostAId, hostBId, participantId, extraParticipantId]
    );

    await pool.query(
      `
      DELETE FROM hangout_acceptances
      WHERE user_id IN ($1, $2, $3, $4);
      `,
      [hostAId, hostBId, participantId, extraParticipantId]
    );

    await pool.query(
      `
      DELETE FROM hangout_posts
      WHERE user_id IN ($1, $2);
      `,
      [hostAId, hostBId]
    );

    const postAResult = await pool.query(
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
        'Accept Test Post A',
        'Primary post for accept integration tests',
        $2,
        5,
        1,
        CURRENT_TIMESTAMP + INTERVAL '2 days'
      )
      RETURNING id;
      `,
      [hostAId, locationId]
    );

    const postBResult = await pool.query(
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
        'Accept Test Post B',
        'Secondary post for one-active-hangout tests',
        $2,
        5,
        1,
        CURRENT_TIMESTAMP + INTERVAL '3 days'
      )
      RETURNING id;
      `,
      [hostBId, locationId]
    );

    const fullPostResult = await pool.query(
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
        'Accept Full Post',
        'Full post for capacity tests',
        $2,
        1,
        1,
        CURRENT_TIMESTAMP + INTERVAL '4 days'
      )
      RETURNING id;
      `,
      [hostBId, locationId]
    );

    postAId = postAResult.rows[0].id;
    postBId = postBResult.rows[0].id;
    fullPostId = fullPostResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(
      `
      DELETE FROM hangout_check_ins
      WHERE user_id IN ($1, $2, $3, $4);
      `,
      [hostAId, hostBId, participantId, extraParticipantId]
    );

    await pool.query(
      `
      DELETE FROM hangout_acceptances
      WHERE user_id IN ($1, $2, $3, $4);
      `,
      [hostAId, hostBId, participantId, extraParticipantId]
    );

    await pool.query(
      `
      DELETE FROM hangout_posts
      WHERE user_id IN ($1, $2);
      `,
      [hostAId, hostBId]
    );

    await pool.query(
      `
      DELETE FROM users
      WHERE id IN ($1, $2, $3, $4);
      `,
      [hostAId, hostBId, participantId, extraParticipantId]
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

  describe('POST /accept/:post_id', () => {
    test('accepts a hangout successfully and increases participant count', async () => {
      const response = await request(app)
        .post(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      expect(response.statusCode).toBe(201);
      expect(response.body.message).toBe('Hangout joined successfully');
      expect(response.body.acceptance).toBeDefined();
      expect(response.body.acceptance.post_id).toBe(postAId);
      expect(response.body.acceptance.user_id).toBe(participantId);
      expect(response.body.current_participants).toBe(2);
      expect(response.body.max_participants).toBe(5);

      const acceptanceResult = await pool.query(
        `
        SELECT *
        FROM hangout_acceptances
        WHERE post_id = $1
          AND user_id = $2;
        `,
        [postAId, participantId]
      );

      expect(acceptanceResult.rows.length).toBe(1);

      const postResult = await pool.query(
        `
        SELECT current_participants
        FROM hangout_posts
        WHERE id = $1;
        `,
        [postAId]
      );

      expect(postResult.rows[0].current_participants).toBe(2);
    });

    test('rejects request with no auth token', async () => {
      const response = await request(app)
        .post(`/accept/${postAId}`);

      expect(response.statusCode).toBe(401);
    });

    test('rejects host accepting their own post', async () => {
      const response = await request(app)
        .post(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${hostAToken}`);

      expect(response.statusCode).toBe(409);
      expect(response.body.message).toBe(
        'You created this hangout and are already counted as the host.'
      );
      expect(response.body.current_participants).toBe(1);
      expect(response.body.max_participants).toBe(5);
    });

    test('rejects accepting the same hangout twice', async () => {
      await request(app)
        .post(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      const response = await request(app)
        .post(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      expect(response.statusCode).toBe(409);
      expect(response.body.message).toBe(
        'You have already joined this hangout.'
      );

      const acceptanceResult = await pool.query(
        `
        SELECT *
        FROM hangout_acceptances
        WHERE user_id = $1;
        `,
        [participantId]
      );

      expect(acceptanceResult.rows.length).toBe(1);

      const postResult = await pool.query(
        `
        SELECT current_participants
        FROM hangout_posts
        WHERE id = $1;
        `,
        [postAId]
      );

      expect(postResult.rows[0].current_participants).toBe(2);
    });

    test('rejects joining another hangout while one is already accepted', async () => {
      await request(app)
        .post(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      const response = await request(app)
        .post(`/accept/${postBId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      expect(response.statusCode).toBe(409);
      expect(response.body.message).toBe(
        'You already joined another hangout. Unaccept it before joining this one.'
      );
      expect(response.body.existing_post_id).toBe(postAId);

      const acceptanceResult = await pool.query(
        `
        SELECT *
        FROM hangout_acceptances
        WHERE user_id = $1;
        `,
        [participantId]
      );

      expect(acceptanceResult.rows.length).toBe(1);
      expect(acceptanceResult.rows[0].post_id).toBe(postAId);
    });

    test('rejects accepting a full hangout', async () => {
      const response = await request(app)
        .post(`/accept/${fullPostId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      expect(response.statusCode).toBe(409);
      expect(response.body.message).toBe(
        'Sorry, this hangout is already full.'
      );
      expect(response.body.isFull).toBe(true);
      expect(response.body.current_participants).toBe(1);
      expect(response.body.max_participants).toBe(1);

      const acceptanceResult = await pool.query(
        `
        SELECT *
        FROM hangout_acceptances
        WHERE post_id = $1
          AND user_id = $2;
        `,
        [fullPostId, participantId]
      );

      expect(acceptanceResult.rows.length).toBe(0);
    });

    test('rejects accepting a post that does not exist', async () => {
      const response = await request(app)
        .post('/accept/999999')
        .set('Authorization', `Bearer ${participantToken}`);

      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Post not found');
    });
  });

  describe('DELETE /accept/:post_id', () => {
    test('unaccepts a hangout successfully and decreases participant count', async () => {
      await request(app)
        .post(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      const response = await request(app)
        .delete(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe(
        'You left the hangout successfully'
      );
      expect(response.body.current_participants).toBe(1);
      expect(response.body.max_participants).toBe(5);

      const acceptanceResult = await pool.query(
        `
        SELECT *
        FROM hangout_acceptances
        WHERE post_id = $1
          AND user_id = $2;
        `,
        [postAId, participantId]
      );

      expect(acceptanceResult.rows.length).toBe(0);

      const postResult = await pool.query(
        `
        SELECT current_participants
        FROM hangout_posts
        WHERE id = $1;
        `,
        [postAId]
      );

      expect(postResult.rows[0].current_participants).toBe(1);
    });

    test('rejects unaccept request with no auth token', async () => {
      const response = await request(app)
        .delete(`/accept/${postAId}`);

      expect(response.statusCode).toBe(401);
    });

    test('returns 404 when acceptance does not exist', async () => {
      const response = await request(app)
        .delete(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Acceptance not found');
    });

    test('returns 404 when post does not exist', async () => {
      const response = await request(app)
        .delete('/accept/999999')
        .set('Authorization', `Bearer ${participantToken}`);

      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Post not found');
    });
  });

  describe('GET /accept/user/:user_id', () => {
    test('returns the accepted hangout for a user', async () => {
      await request(app)
        .post(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      const response = await request(app)
        .get(`/accept/user/${participantId}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].post_id).toBe(postAId);
      expect(response.body[0].user_id).toBe(participantId);
      expect(response.body[0].post_title).toBe('Accept Test Post A');
      expect(response.body[0].current_participants).toBe(2);
      expect(response.body[0].max_participants).toBe(5);
    });

    test('returns an empty array when user has no accepted hangout', async () => {
      const response = await request(app)
        .get(`/accept/user/${extraParticipantId}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /accept/:post_id', () => {
    test('returns acceptance records for a post', async () => {
      await request(app)
        .post(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      const response = await request(app)
        .get(`/accept/${postAId}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].post_id).toBe(postAId);
      expect(response.body[0].user_id).toBe(participantId);
    });
  });

  describe('GET /accept/:post_id/participants', () => {
    test('returns host, accepted participants, and capacity details', async () => {
      await request(app)
        .post(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      const response = await request(app)
        .get(`/accept/${postAId}/participants`);

      expect(response.statusCode).toBe(200);
      expect(response.body.post_id).toBe(postAId);
      expect(response.body.current_participants).toBe(2);
      expect(response.body.max_participants).toBe(5);
      expect(response.body.is_full).toBe(false);
      expect(Array.isArray(response.body.participants)).toBe(true);
      expect(response.body.participants.length).toBe(2);

      const host = response.body.participants.find(
        (participant) => participant.user_id === hostAId
      );

      const acceptedParticipant = response.body.participants.find(
        (participant) => participant.user_id === participantId
      );

      expect(host).toBeDefined();
      expect(host.student_name).toBe('Accept Host A');
      expect(host.is_host).toBe(true);

      expect(acceptedParticipant).toBeDefined();
      expect(acceptedParticipant.student_name).toBe('Accept Participant');
      expect(acceptedParticipant.is_host).toBe(false);
    });

    test('returns 404 when post does not exist', async () => {
      const response = await request(app)
        .get('/accept/999999/participants');

      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Post not found');
    });
  });

  describe('GET /accept', () => {
    test('returns all acceptances', async () => {
      await request(app)
        .post(`/accept/${postAId}`)
        .set('Authorization', `Bearer ${participantToken}`);

      const response = await request(app)
        .get('/accept');

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const foundAcceptance = response.body.find(
        (acceptance) =>
          acceptance.post_id === postAId &&
          acceptance.user_id === participantId
      );

      expect(foundAcceptance).toBeDefined();
    });
  });
});