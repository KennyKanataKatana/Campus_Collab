process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'test-jwt-secret';
process.env.JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');
const invitationModel = require('../../src/models/HangoutInvitationModel');
const notificationModel = require('../../src/models/NotificationModel');

let seedNumber = 0;
let seededUserIds = [];
let seededLocationIds = [];

function authHeader(userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

async function seedScenario() {
  const uniqueId = `${process.pid}-${Date.now()}-${seedNumber++}`;
  const users = await pool.query(
    `
    INSERT INTO users (student_name, student_email, password_hash)
    VALUES ($1, $2, 'hash'),
           ($3, $4, 'hash'),
           ($5, $6, 'hash')
    RETURNING id
  `,
    [
      `Invitation owner ${uniqueId}`,
      `invitation-owner-${uniqueId}@ichat.sp.edu.sg`,
      `Invitation friend ${uniqueId}`,
      `invitation-friend-${uniqueId}@ichat.sp.edu.sg`,
      `Invitation stranger ${uniqueId}`,
      `invitation-stranger-${uniqueId}@ichat.sp.edu.sg`,
    ],
  );
  const [owner, friend, stranger] = users.rows;
  const location = await pool.query(
    `INSERT INTO sp_locations (location_name) VALUES ($1) RETURNING id`,
    [`Invitation test location ${uniqueId}`],
  );
  const post = await pool.query(
    `INSERT INTO hangout_posts
      (user_id, title, description, location_id, max_participants, hangout_at)
     VALUES ($1, $2, 'Testing', $3, 3, CURRENT_TIMESTAMP + INTERVAL '3 days')
     RETURNING id`,
    [owner.id, `Invitation test hangout ${uniqueId}`, location.rows[0].id],
  );
  await pool.query(
    `INSERT INTO friend_requests (sender_id, receiver_id, status)
     VALUES ($1, $2, 'ACCEPTED')`,
    [owner.id, friend.id],
  );

  seededUserIds.push(owner.id, friend.id, stranger.id);
  seededLocationIds.push(location.rows[0].id);

  return { owner, friend, stranger, post: post.rows[0] };
}

afterEach(async () => {
  if (seededUserIds.length > 0) {
    await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [seededUserIds]);
    seededUserIds = [];
  }

  if (seededLocationIds.length > 0) {
    await pool.query('DELETE FROM sp_locations WHERE id = ANY($1::int[])', [seededLocationIds]);
    seededLocationIds = [];
  }
});

afterAll(async () => {
  await pool.end();
});

test('rejects self-invitations and non-friends', async () => {
  const { owner, stranger, post } = await seedScenario();
  await expect(invitationModel.createInvitation(post.id, owner.id, owner.id)).rejects.toThrow(
    'You cannot invite yourself.',
  );
  await expect(invitationModel.createInvitation(post.id, owner.id, stranger.id)).rejects.toThrow(
    'You can only invite accepted friends.',
  );
});

test('creates one pending invitation and rejects a duplicate', async () => {
  const { owner, friend, post } = await seedScenario();
  const invitation = await invitationModel.createInvitation(post.id, owner.id, friend.id);
  expect(invitation.status).toBe('PENDING');
  expect(invitation.expires_at).toBeTruthy();
  await expect(invitationModel.createInvitation(post.id, owner.id, friend.id)).rejects.toThrow(
    'A pending invitation has already been sent to this user.',
  );
});

test('rejects non-owners, joined users, full hangouts, and expired hangouts', async () => {
  let scenario = await seedScenario();
  await expect(
    invitationModel.createInvitation(scenario.post.id, scenario.friend.id, scenario.owner.id),
  ).rejects.toThrow('Only the hangout owner can invite friends.');

  await pool.query(`INSERT INTO hangout_acceptances (post_id, user_id) VALUES ($1, $2)`, [
    scenario.post.id,
    scenario.friend.id,
  ]);
  await expect(
    invitationModel.createInvitation(scenario.post.id, scenario.owner.id, scenario.friend.id),
  ).rejects.toThrow('This friend has already joined the hangout.');

  scenario = await seedScenario();
  await pool.query(`UPDATE hangout_posts SET max_participants = 2 WHERE id = $1`, [
    scenario.post.id,
  ]);
  await pool.query(`INSERT INTO hangout_acceptances (post_id, user_id) VALUES ($1, $2)`, [
    scenario.post.id,
    scenario.stranger.id,
  ]);
  await expect(
    invitationModel.createInvitation(scenario.post.id, scenario.owner.id, scenario.friend.id),
  ).rejects.toThrow('This hangout is already full.');

  await pool.query(`DELETE FROM hangout_acceptances WHERE post_id = $1`, [scenario.post.id]);
  await pool.query(
    `UPDATE hangout_posts SET hangout_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = $1`,
    [scenario.post.id],
  );
  await expect(
    invitationModel.createInvitation(scenario.post.id, scenario.owner.id, scenario.friend.id),
  ).rejects.toThrow('This hangout has already started or expired.');
});

test('expires stale invitations and creates an expiration notification', async () => {
  const { owner, friend, post } = await seedScenario();
  const invitation = await invitationModel.createInvitation(post.id, owner.id, friend.id);
  await pool.query(
    `UPDATE hangout_invitations SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'
     WHERE id = $1`,
    [invitation.id],
  );

  const received = await invitationModel.getReceivedInvitations(friend.id);
  expect(received[0].status).toBe('EXPIRED');
  const notifications = await notificationModel.getNotifications(friend.id);
  expect(notifications.some((item) => item.type === 'INVITATION_EXPIRED')).toBe(true);
});

test('returns a friend to the picker after their pending invitation expires', async () => {
  const { owner, friend, post } = await seedScenario();
  const invitation = await invitationModel.createInvitation(post.id, owner.id, friend.id);
  expect(await invitationModel.getInvitableFriends(owner.id, post.id)).toEqual([]);

  await pool.query(
    `UPDATE hangout_invitations SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'
     WHERE id = $1`,
    [invitation.id],
  );

  const invitable = await invitationModel.getInvitableFriends(owner.id, post.id);
  expect(invitable.map((user) => user.id)).toContain(friend.id);
});

test('does not offer friends when the hangout is full or has started', async () => {
  const { owner, stranger, post } = await seedScenario();
  await pool.query(`UPDATE hangout_posts SET max_participants = 2 WHERE id = $1`, [post.id]);
  await pool.query(`INSERT INTO hangout_acceptances (post_id, user_id) VALUES ($1, $2)`, [
    post.id,
    stranger.id,
  ]);
  expect(await invitationModel.getInvitableFriends(owner.id, post.id)).toEqual([]);

  await pool.query(`DELETE FROM hangout_acceptances WHERE post_id = $1`, [post.id]);
  await pool.query(
    `UPDATE hangout_posts SET hangout_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = $1`,
    [post.id],
  );
  expect(await invitationModel.getInvitableFriends(owner.id, post.id)).toEqual([]);
});

test('accepts atomically and notifies the sender', async () => {
  const { owner, friend, post } = await seedScenario();
  const invitation = await invitationModel.createInvitation(post.id, owner.id, friend.id);
  const accepted = await invitationModel.acceptInvitation(invitation.id, friend.id);
  expect(accepted.status).toBe('ACCEPTED');

  const acceptance = await pool.query(
    `SELECT * FROM hangout_acceptances WHERE post_id = $1 AND user_id = $2`,
    [post.id, friend.id],
  );
  expect(acceptance.rowCount).toBe(1);

  const postParticipants = await pool.query(
    `SELECT current_participants FROM hangout_posts WHERE id = $1`,
    [post.id],
  );
  expect(postParticipants.rows[0].current_participants).toBe(2);

  const notifications = await notificationModel.getNotifications(owner.id);
  expect(notifications.some((item) => item.type === 'INVITATION_ACCEPTED')).toBe(true);
});

test('allows the receiver to decline and the sender to cancel pending invitations', async () => {
  const { owner, friend, post } = await seedScenario();
  const firstInvitation = await invitationModel.createInvitation(post.id, owner.id, friend.id);

  const unauthorizedDecline = await request(app)
    .patch(`/hangout-invitations/decline/${firstInvitation.id}`)
    .set('Authorization', authHeader(owner.id));
  expect(unauthorizedDecline.status).toBe(403);

  const declined = await request(app)
    .patch(`/hangout-invitations/decline/${firstInvitation.id}`)
    .set('Authorization', authHeader(friend.id));
  expect(declined.status).toBe(200);
  expect(declined.body.invitation.status).toBe('DECLINED');

  const declinedAcceptance = await pool.query(
    `SELECT * FROM hangout_acceptances WHERE post_id = $1 AND user_id = $2`,
    [post.id, friend.id],
  );
  expect(declinedAcceptance.rowCount).toBe(0);

  const ownerNotifications = await notificationModel.getNotifications(owner.id);
  expect(ownerNotifications.some((item) => item.type === 'INVITATION_DECLINED')).toBe(true);

  const secondInvitation = await invitationModel.createInvitation(post.id, owner.id, friend.id);
  const unauthorizedCancellation = await request(app)
    .patch(`/hangout-invitations/cancel/${secondInvitation.id}`)
    .set('Authorization', authHeader(friend.id));
  expect(unauthorizedCancellation.status).toBe(403);

  const cancelled = await request(app)
    .patch(`/hangout-invitations/cancel/${secondInvitation.id}`)
    .set('Authorization', authHeader(owner.id));
  expect(cancelled.status).toBe(200);
  expect(cancelled.body.invitation.status).toBe('CANCELLED');

  const friendNotifications = await notificationModel.getNotifications(friend.id);
  expect(friendNotifications.some((item) => item.type === 'INVITATION_CANCELLED')).toBe(true);
});

test('enforces invitation API authentication, validation, authorization, and acceptance', async () => {
  const { owner, friend, stranger, post } = await seedScenario();

  const unauthenticated = await request(app)
    .post('/hangout-invitations')
    .send({ post_id: post.id, receiver_id: friend.id });
  expect(unauthenticated.status).toBe(401);

  const invalid = await request(app)
    .post('/hangout-invitations')
    .set('Authorization', authHeader(owner.id))
    .send({ post_id: 'not-an-id', receiver_id: friend.id });
  expect(invalid.status).toBe(400);

  const notOwner = await request(app)
    .post('/hangout-invitations')
    .set('Authorization', authHeader(friend.id))
    .send({ post_id: post.id, receiver_id: stranger.id });
  expect(notOwner.status).toBe(403);

  const created = await request(app)
    .post('/hangout-invitations')
    .set('Authorization', authHeader(owner.id))
    .send({ post_id: post.id, receiver_id: friend.id });
  expect(created.status).toBe(201);
  expect(created.body.status).toBe('PENDING');

  const duplicate = await request(app)
    .post('/hangout-invitations')
    .set('Authorization', authHeader(owner.id))
    .send({ post_id: post.id, receiver_id: friend.id });
  expect(duplicate.status).toBe(409);

  const accepted = await request(app)
    .patch(`/hangout-invitations/accept/${created.body.id}`)
    .set('Authorization', authHeader(friend.id));
  expect(accepted.status).toBe(200);
  expect(accepted.body.invitation.status).toBe('ACCEPTED');
});
