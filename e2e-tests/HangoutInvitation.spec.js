require('dotenv').config({ path: '.env.test' });

const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const jwtSecret = process.env.JWT_SECRET_KEY || 'test-jwt-secret';
const jwtAlgorithm = process.env.JWT_ALGORITHM || 'HS256';
let seedNumber = 0;
let scenario;

function createToken(userId) {
  return jwt.sign({ userId }, jwtSecret, { algorithm: jwtAlgorithm, expiresIn: '1h' });
}

async function authenticatePage(page, userId) {
  const token = createToken(userId);

  await page.addInitScript(
    ({ sessionToken, sessionUserId }) => {
      localStorage.setItem('token', sessionToken);
      localStorage.setItem('userId', String(sessionUserId));
    },
    { sessionToken: token, sessionUserId: userId },
  );
}

async function prepareInvitationScenario() {
  const uniqueId = `${process.pid}-${Date.now()}-${seedNumber++}`;
  const ownerName = `Invitation owner ${uniqueId}`;
  const invitedName = `Invitation receiver ${uniqueId}`;
  const friendName = `Invitation friend ${uniqueId}`;
  const users = await pool.query(
    `
      INSERT INTO users (student_name, student_email, password_hash)
      VALUES ($1, $2, 'hash'),
             ($3, $4, 'hash'),
             ($5, $6, 'hash')
      RETURNING id, student_name
    `,
    [
      ownerName,
      `invitation-e2e-owner-${uniqueId}@ichat.sp.edu.sg`,
      invitedName,
      `invitation-e2e-receiver-${uniqueId}@ichat.sp.edu.sg`,
      friendName,
      `invitation-e2e-friend-${uniqueId}@ichat.sp.edu.sg`,
    ],
  );
  const [owner, invitedUser, friend] = users.rows;
  const location = await pool.query(
    `INSERT INTO sp_locations (location_name) VALUES ($1) RETURNING id`,
    [`Invitation E2E location ${uniqueId}`],
  );
  const post = await pool.query(
    `
      INSERT INTO hangout_posts
        (user_id, title, description, location_id, max_participants, hangout_at)
      VALUES ($1, $2, 'Invitation browser-test hangout', $3, 5,
        CURRENT_TIMESTAMP + INTERVAL '3 days')
      RETURNING id, title
    `,
    [owner.id, `Invitation E2E hangout ${uniqueId}`, location.rows[0].id],
  );
  await pool.query(
    `
      INSERT INTO hangout_invitations (post_id, sender_id, receiver_id, expires_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '2 days')
    `,
    [post.rows[0].id, owner.id, invitedUser.id],
  );
  await pool.query(
    `
    INSERT INTO friend_requests (sender_id, receiver_id, status)
    VALUES ($1, $2, 'ACCEPTED')
  `,
    [owner.id, friend.id],
  );

  return { owner, invitedUser, friend, location: location.rows[0], post: post.rows[0] };
}

async function cleanUpInvitationScenario() {
  if (!scenario) {
    return;
  }

  await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [
    [scenario.owner.id, scenario.invitedUser.id, scenario.friend.id],
  ]);
  await pool.query('DELETE FROM sp_locations WHERE id = $1', [scenario.location.id]);
  scenario = undefined;
}

test.beforeEach(async () => {
  scenario = await prepareInvitationScenario();
});

test.afterEach(async () => {
  await cleanUpInvitationScenario();
});

test.afterAll(async () => {
  await pool.end();
});

test('an invited user can accept a pending invitation', async ({ page }) => {
  await authenticatePage(page, scenario.invitedUser.id);
  await page.goto('/invitations.html');

  const invitationCard = page.locator('#received-container .invitation-card').filter({
    hasText: scenario.post.title,
  });

  await expect(invitationCard).toContainText(`Invited by: ${scenario.owner.student_name}`);
  await expect(invitationCard).toContainText('PENDING');

  page.once('dialog', (dialog) => dialog.accept());
  await invitationCard.getByRole('button', { name: 'Accept', exact: true }).click();

  await expect(page.locator('#message-box')).toHaveText('Invitation accepted successfully.');
  await expect(invitationCard).toContainText('ACCEPTED');

  const acceptance = await pool.query(
    `SELECT 1 FROM hangout_acceptances WHERE post_id = $1 AND user_id = $2`,
    [scenario.post.id, scenario.invitedUser.id],
  );
  expect(acceptance.rowCount).toBe(1);
});

test('an invited user can decline a pending invitation', async ({ page }) => {
  await authenticatePage(page, scenario.invitedUser.id);
  await page.goto('/invitations.html');

  const invitationCard = page.locator('#received-container .invitation-card').filter({
    hasText: scenario.post.title,
  });

  await expect(invitationCard).toContainText('PENDING');

  page.once('dialog', (dialog) => dialog.accept());
  await invitationCard.getByRole('button', { name: 'Decline', exact: true }).click();

  await expect(page.locator('#message-box')).toHaveText('Invitation declined.');
  await expect(invitationCard).toContainText('DECLINED');

  const invitation = await pool.query(
    `SELECT status FROM hangout_invitations WHERE post_id = $1 AND receiver_id = $2`,
    [scenario.post.id, scenario.invitedUser.id],
  );
  expect(invitation.rows[0]).toEqual({ status: 'DECLINED' });
});

test('a hangout owner can bulk-invite an accepted friend', async ({ page }) => {
  await authenticatePage(page, scenario.owner.id);
  await page.goto(`/invitations.html?postId=${scenario.post.id}`);

  await page.getByRole('button', { name: 'Invite Friends' }).click();

  const friendCard = page
    .locator('label.selectable-friend-card')
    .filter({ hasText: scenario.friend.student_name });
  await expect(friendCard).toBeVisible();
  await friendCard.locator('.friend-invite-checkbox').check();

  await expect(page.locator('#selected-friends-count')).toHaveText('1 selected');
  await page.getByRole('button', { name: 'Invite Selected Friends' }).click();

  await expect(page.locator('#message-box')).toHaveText('1 invitation sent successfully.');

  await page.getByRole('button', { name: 'Close invite modal' }).click();
  await page.getByRole('button', { name: /Sent/ }).click();
  await expect(page.locator('#sent-container')).toContainText(scenario.friend.student_name);
  await expect(page.locator('#sent-container')).toContainText('PENDING');
});
