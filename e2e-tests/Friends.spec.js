require('dotenv').config({ path: '.env.test' });

const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const jwtSecret = process.env.JWT_SECRET_KEY || 'test-jwt-secret';
const jwtAlgorithm = process.env.JWT_ALGORITHM || 'HS256';

function createToken(userId) {
  return jwt.sign({ userId }, jwtSecret, { algorithm: jwtAlgorithm, expiresIn: '1h' });
}

async function authenticatePage(page, userId) {
  await page.addInitScript(
    ({ sessionToken, sessionUserId }) => {
      localStorage.setItem('token', sessionToken);
      localStorage.setItem('userId', String(sessionUserId));
    },
    { sessionToken: createToken(userId), sessionUserId: userId },
  );
}

async function prepareFriendScenario() {
  await pool.query(
    `
      DELETE FROM friend_requests
      WHERE (sender_id = $1 AND receiver_id IN ($2, $3))
         OR (receiver_id = $1 AND sender_id IN ($2, $3))
    `,
    [1, 2, 5],
  );
  await pool.query(`
    INSERT INTO friend_requests (sender_id, receiver_id, status)
    VALUES (1, 2, 'PENDING')
  `);
}

test.beforeEach(async () => {
  await prepareFriendScenario();
});

test.afterAll(async () => {
  await pool.end();
});

test('a receiver can accept a pending friend request from the Friends page', async ({ page }) => {
  await authenticatePage(page, 2);
  await page.goto('/friends.html');

  await page.getByRole('button', { name: /Requests/ }).click();
  const requestCard = page.locator('#requests-container .card').filter({ hasText: 'Sarah Lim' });
  await expect(requestCard).toContainText('sent you a friend request');

  await requestCard.getByRole('button', { name: 'Accept' }).click();
  await expect(page.locator('#friend-count')).toHaveText('1 Friend');
  await expect(page.locator('#friends-container')).toContainText('Sarah Lim');
});

test('a user can search for a student and send a friend request', async ({ page }) => {
  await authenticatePage(page, 1);
  await page.goto('/friends.html');

  await page.getByRole('button', { name: '+ Add Friend', exact: true }).click();
  await page.getByPlaceholder('Search student name...').fill('Ryan');
  await page.getByPlaceholder('Search student name...').press('End');

  const resultCard = page.locator('#search-results .card').filter({ hasText: 'Ryan Ong' });
  await expect(resultCard).toBeVisible();

  const successDialog = page.waitForEvent('dialog');
  await resultCard.getByRole('button', { name: 'Add Friend' }).click();
  await (await successDialog).accept();

  const request = await pool.query(`
    SELECT status FROM friend_requests WHERE sender_id = 1 AND receiver_id = 5
  `);
  expect(request.rows[0]).toEqual({ status: 'PENDING' });
});

test('a receiver can reject a pending friend request from the Friends page', async ({ page }) => {
  await authenticatePage(page, 2);
  await page.goto('/friends.html');

  await page.getByRole('button', { name: /Requests/ }).click();
  const requestCard = page.locator('#requests-container .card').filter({ hasText: 'Sarah Lim' });
  await requestCard.getByRole('button', { name: 'Reject' }).click();

  await expect(page.locator('#requests-container')).not.toContainText('Sarah Lim');

  const request = await pool.query(`
    SELECT status FROM friend_requests WHERE sender_id = 1 AND receiver_id = 2
  `);
  expect(request.rows[0]).toEqual({ status: 'REJECTED' });
});
