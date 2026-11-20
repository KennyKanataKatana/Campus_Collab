require('dotenv').config({ path: '.env.test' });

const { test, expect } = require('@playwright/test');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const BASE_URL = 'http://127.0.0.1:3001';

const USER = {
  email: 'sarahlim.23@ichat.sp.edu.sg',
  password: 'password123',
};

const USER_ID = 1;
const ACCEPTED_POST_ID = 2;

async function login(page) {
  await page.goto(`${BASE_URL}/login.html`);
  await page.locator('#email').fill(USER.email);
  await page.locator('#password').fill(USER.password);

  const journeyPopup = page.locator('#journeyPopup');

  if (await journeyPopup.isVisible()) {
    await page.locator('#closeJourneyPopupButton').click();
    await expect(journeyPopup).toBeHidden();
  }

  await page.getByRole('button', { name: "Let's Go" }).click();

  await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).not.toBeNull();
}

async function restoreOwnedState() {
  await pool.query('DELETE FROM hangout_check_ins WHERE user_id = $1;', [USER_ID]);

  await pool.query(
    `
      INSERT INTO hangout_acceptances (post_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET
        post_id = EXCLUDED.post_id,
        accepted_at = CURRENT_TIMESTAMP;
    `,
    [ACCEPTED_POST_ID, USER_ID],
  );
}

test.beforeEach(async ({ page }) => {
  await restoreOwnedState();
  await login(page);
});

test.afterAll(async () => {
  await restoreOwnedState();
  await pool.end();
});

test.describe('Check-In user journeys', () => {
  test('shows the logged-in users accepted hangout as eligible', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkin.html`);

    await expect(
      page.getByRole('heading', {
        name: 'Hangout Check-In',
      }),
    ).toBeVisible();

    await expect(page.locator('#eligiblePost')).toContainText('Lunch Hangout');
    await expect(page.locator('#eligiblePost')).toContainText('SP Food Court 6');
  });

  test('creates a check-in and displays real hangout details', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkin.html`);
    await page.locator('#eligiblePost').selectOption(String(ACCEPTED_POST_ID));

    await page.getByRole('button', { name: 'Check In' }).click();

    await expect(page.getByTestId('checkin-message')).toContainText('Checked in successfully');

    const card = page.getByTestId('checkin-card');

    await expect(card).toContainText('Lunch Hangout');
    await expect(card).toContainText('Daniel Lee');
    await expect(card).toContainText('SP Food Court 6');
  });

  test('filters and cancels a completed check-in', async ({ page }) => {
    await pool.query(
      `
        INSERT INTO hangout_check_ins (post_id, user_id)
        VALUES ($1, $2);
      `,
      [ACCEPTED_POST_ID, USER_ID],
    );

    await page.goto(`${BASE_URL}/checkin.html`);

    await page.locator('#postIdFilter').fill('99999');

    await expect(page.getByTestId('checkin-empty-state')).toContainText('No matching check-in');

    await page.locator('#postIdFilter').fill(String(ACCEPTED_POST_ID));

    await expect(page.getByTestId('checkin-card')).toContainText('Lunch Hangout');

    page.once('dialog', (dialog) => dialog.accept());

    await page.getByRole('button', { name: 'Cancel Check-In' }).click();

    await expect(page.getByTestId('checkin-message')).toContainText('cancelled successfully');

    await expect(page.getByTestId('checkin-empty-state')).toContainText('No matching check-in');
  });
});

test.describe('Index homepage journeys', () => {
  test('shows the logged-in users accepted hangout and account details', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);

    const card = page.getByTestId('accepted-post-card');

    await expect(card).toContainText('Lunch Hangout');
    await expect(card).toContainText(`Post ID: ${ACCEPTED_POST_ID}`);
    await expect(page.locator('#homepageUsername')).toHaveText('Sarah Lim');
    await expect(page.locator('#homepageEmail')).toHaveText(USER.email);
  });

  test('opens Check-In with the accepted hangout preselected', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);

    await page.getByRole('link', { name: 'Go to Check-In' }).click();

    await expect(page).toHaveURL(/checkin\.html\?postId=2/);
    await expect(page.locator('#eligiblePost')).toHaveValue(String(ACCEPTED_POST_ID));
  });

  test('requires confirmation and removes a cancelled acceptance', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);

    const dialogMessages = [];

    page.on('dialog', function (dialog) {
      dialogMessages.push(dialog.message());
      return dialog.accept();
    });

    await page.getByRole('button', { name: 'Cancel Accept' }).click();

    await expect.poll(() => dialogMessages.length).toBe(2);
    expect(dialogMessages[0]).toContain('Are you sure you want to cancel');

    await expect(page.getByTestId('accepted-empty-state')).toContainText(
      'No accepted hangout posts yet',
    );
  });
});

test.describe('Profile dashboard journeys', () => {
  test('shows the completed check-in statistic from the database', async ({ page }) => {
    await pool.query(
      `
        INSERT INTO hangout_check_ins (post_id, user_id)
        VALUES ($1, $2);
      `,
      [ACCEPTED_POST_ID, USER_ID],
    );

    await page.goto(`${BASE_URL}/profile.html`);

    await expect(page.getByTestId('checkin-stat')).toHaveText('1');

    await expect(page.locator('#profileSummary')).toContainText('completed 1 check-ins');
  });

  test('shows the logged-in users account and activity details', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile.html`);

    await expect(page.locator('#profileName')).toHaveText('Sarah Lim');
    await expect(page.locator('#profileEmail')).toHaveText(USER.email);
    await expect(page.locator('#favouriteLocation')).toHaveText('SP Library');

    await expect(page.getByTestId('profile-message')).toContainText('Profile loaded successfully');
  });

  test('redirects unauthenticated visitors to login', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/profile.html`);

    await expect(page).toHaveURL(/login\.html/);
  });
});
