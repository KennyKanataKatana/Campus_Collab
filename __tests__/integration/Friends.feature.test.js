process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'test-jwt-secret';
process.env.JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

let seedNumber = 0;
let seededUserIds = [];

function authHeader(userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

async function seedUsers() {
  const uniqueId = `${process.pid}-${Date.now()}-${seedNumber++}`;
  const caseySearchTerm = `casey-friends-${uniqueId}`;
  const users = await pool.query(
    `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ($1, $2, 'hash'),
             ($3, $4, 'hash'),
             ($5, $6, 'hash')
      RETURNING id, student_name
    `,
    [
      `Alex friends-${uniqueId}`,
      `alex-friends-${uniqueId}@ichat.sp.edu.sg`,
      `Blair friends-${uniqueId}`,
      `blair-friends-${uniqueId}@ichat.sp.edu.sg`,
      `Casey ${caseySearchTerm}`,
      `casey-friends-${uniqueId}@ichat.sp.edu.sg`,
    ],
  );
  const [alex, blair, casey] = users.rows;
  seededUserIds.push(alex.id, blair.id, casey.id);
  return { alex, blair, casey, caseySearchTerm };
}

afterEach(async () => {
  if (seededUserIds.length > 0) {
    await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [seededUserIds]);
    seededUserIds = [];
  }
});

afterAll(async () => {
  await pool.end();
});

test('requires authentication for Friends endpoints', async () => {
  const response = await request(app).post('/friends/request').send({ receiver_id: 2 });
  expect(response.status).toBe(401);
});

test('validates and creates a friend request while rejecting duplicate relationships', async () => {
  const { alex, blair } = await seedUsers();

  const selfRequest = await request(app)
    .post('/friends/request')
    .set('Authorization', authHeader(alex.id))
    .send({ receiver_id: alex.id });
  expect(selfRequest.status).toBe(400);

  const invalidRequest = await request(app)
    .post('/friends/request')
    .set('Authorization', authHeader(alex.id))
    .send({ receiver_id: 'invalid' });
  expect(invalidRequest.status).toBe(400);

  const created = await request(app)
    .post('/friends/request')
    .set('Authorization', authHeader(alex.id))
    .send({ receiver_id: blair.id });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({
    sender_id: alex.id,
    receiver_id: blair.id,
    status: 'PENDING',
  });

  const duplicate = await request(app)
    .post('/friends/request')
    .set('Authorization', authHeader(alex.id))
    .send({ receiver_id: blair.id });
  expect(duplicate.status).toBe(409);

  const reverseDuplicate = await request(app)
    .post('/friends/request')
    .set('Authorization', authHeader(blair.id))
    .send({ receiver_id: alex.id });
  expect(reverseDuplicate.status).toBe(409);
});

test('only the requested user can view their pending, sent, and accepted friend lists', async () => {
  const { alex, blair, casey } = await seedUsers();
  const created = await request(app)
    .post('/friends/request')
    .set('Authorization', authHeader(alex.id))
    .send({ receiver_id: blair.id });

  const pending = await request(app)
    .get(`/friends/pending/${blair.id}`)
    .set('Authorization', authHeader(blair.id));
  expect(pending.status).toBe(200);
  expect(pending.body).toEqual([
    expect.objectContaining({
      id: created.body.id,
      sender_name: alex.student_name,
      status: 'PENDING',
    }),
  ]);

  const sent = await request(app)
    .get(`/friends/sent/${alex.id}`)
    .set('Authorization', authHeader(alex.id));
  expect(sent.status).toBe(200);
  expect(sent.body).toEqual([
    expect.objectContaining({
      id: created.body.id,
      receiver_name: blair.student_name,
      status: 'PENDING',
    }),
  ]);

  for (const path of [
    `/friends/pending/${blair.id}`,
    `/friends/sent/${alex.id}`,
    `/friends/list/${alex.id}`,
  ]) {
    const forbidden = await request(app).get(path).set('Authorization', authHeader(casey.id));
    expect(forbidden.status).toBe(403);
  }
});

test('only the receiver can accept a pending request and both users can then view the friendship', async () => {
  const { alex, blair, casey } = await seedUsers();
  const created = await request(app)
    .post('/friends/request')
    .set('Authorization', authHeader(alex.id))
    .send({ receiver_id: blair.id });

  const unauthorized = await request(app)
    .patch(`/friends/accept/${created.body.id}`)
    .set('Authorization', authHeader(casey.id));
  expect(unauthorized.status).toBe(404);

  const accepted = await request(app)
    .patch(`/friends/accept/${created.body.id}`)
    .set('Authorization', authHeader(blair.id));
  expect(accepted.status).toBe(200);
  expect(accepted.body.status).toBe('ACCEPTED');

  const alexFriends = await request(app)
    .get(`/friends/list/${alex.id}`)
    .set('Authorization', authHeader(alex.id));
  expect(alexFriends.body).toEqual([
    expect.objectContaining({ sender_id: alex.id, receiver_id: blair.id, status: 'ACCEPTED' }),
  ]);

  const repeatAcceptance = await request(app)
    .patch(`/friends/accept/${created.body.id}`)
    .set('Authorization', authHeader(blair.id));
  expect(repeatAcceptance.status).toBe(404);
});

test('allows the receiver to reject a pending request without creating a friendship', async () => {
  const { alex, blair } = await seedUsers();
  const created = await request(app)
    .post('/friends/request')
    .set('Authorization', authHeader(alex.id))
    .send({ receiver_id: blair.id });

  const rejected = await request(app)
    .patch(`/friends/reject/${created.body.id}`)
    .set('Authorization', authHeader(blair.id));
  expect(rejected.status).toBe(200);
  expect(rejected.body.status).toBe('REJECTED');

  const friends = await request(app)
    .get(`/friends/list/${alex.id}`)
    .set('Authorization', authHeader(alex.id));
  expect(friends.body).toEqual([]);
});

test('searches users and suggests people with mutual friends', async () => {
  const { alex, blair, casey, caseySearchTerm } = await seedUsers();
  await pool.query(
    `
    INSERT INTO friend_requests (sender_id, receiver_id, status)
    VALUES ($1, $2, 'ACCEPTED'), ($2, $3, 'ACCEPTED')
  `,
    [alex.id, blair.id, casey.id],
  );

  const search = await request(app)
    .get(`/friends/search/${encodeURIComponent(caseySearchTerm)}`)
    .set('Authorization', authHeader(alex.id));
  expect(search.status).toBe(200);
  expect(search.body).toEqual([
    expect.objectContaining({ id: casey.id, student_name: casey.student_name }),
  ]);

  const suggestions = await request(app)
    .get('/friends/suggestions')
    .set('Authorization', authHeader(alex.id));
  expect(suggestions.status).toBe(200);
  expect(suggestions.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: casey.id,
        student_name: casey.student_name,
        mutual_count: '1',
      }),
    ]),
  );
});

test('only an accepted friendship participant can remove the relationship', async () => {
  const { alex, blair, casey } = await seedUsers();
  const relationship = await pool.query(
    `
    INSERT INTO friend_requests (sender_id, receiver_id, status)
    VALUES ($1, $2, 'ACCEPTED')
    RETURNING id
  `,
    [alex.id, blair.id],
  );
  const relationshipId = relationship.rows[0].id;

  const outsider = await request(app)
    .delete(`/friends/remove/${relationshipId}`)
    .set('Authorization', authHeader(casey.id));
  expect(outsider.status).toBe(404);

  const removed = await request(app)
    .delete(`/friends/remove/${relationshipId}`)
    .set('Authorization', authHeader(alex.id));
  expect(removed.status).toBe(200);
  expect(removed.body.message).toBe('Friend removed');

  const remaining = await pool.query('SELECT * FROM friend_requests WHERE id = $1', [
    relationshipId,
  ]);
  expect(remaining.rowCount).toBe(0);
});
