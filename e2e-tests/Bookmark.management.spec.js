require("dotenv").config({
    path: "../.env.test"
});

const { test, expect } = require("@playwright/test");
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const BASE_URL = "http://127.0.0.1:3001";

const USER = {
    email: "sarahlim.23@ichat.sp.edu.sg",
    password: "password123"
};

const SARAH_ID = 1;
const LUNCH_POST_ID = 2;


// LOGIN HELPER
async function login(page) {

  await page.goto(`${BASE_URL}/login.html`);


  // Close journey popup if it appears
  const popupButton = page.locator("#closeJourneyPopupButton");

  if (await popupButton.isVisible()) {
    await popupButton.click();
  }


  await page.locator('#email')
    .fill(USER.email);

  await page.locator('#password')
    .fill(USER.password);


  await page.getByRole('button', {
    name: "Let's Go"
  }).click();


  // Wait for token to be stored
  await expect.poll(async () =>
    await page.evaluate(() =>
      localStorage.getItem('token')
    )
  ).not.toBeNull();


  // Wait for login redirect to finish
  await page.waitForURL(`${BASE_URL}/index.html`);

}

// DATABASE CLEANUP
async function resetDatabase() {

  // Restore Sarah's bookmark to Lunch Hangout
  await pool.query(
    `
    INSERT INTO bookmarked_posts
    (
      user_id,
      post_id
    )
    VALUES ($1,$2)
    ON CONFLICT DO NOTHING
    `,
    [
      SARAH_ID,
      LUNCH_POST_ID
    ]
  );

}


// SETUP
test.beforeEach(async ({ page }) => {

  await login(page);

  await page.goto(`${BASE_URL}/bookmark.html`);

  await page.waitForSelector('#bookmarkList');

});


test.afterEach(async () => {

  await resetDatabase();

});


test.afterAll(async () => {

  await pool.end();

});




// PAGE LOAD TESTS
test.describe('Bookmark Page Load', () => {


  test('should display bookmarks heading', async ({ page }) => {

    await expect(
      page.getByRole('heading', {
        name: /My Bookmarks/i
      })
    ).toBeVisible();

  });


  test('should display bookmark list container', async ({ page }) => {

    await expect(
      page.locator('#bookmarkList')
    ).toBeVisible();

  });


});




// LOAD BOOKMARKS
test.describe('Load Bookmarks', () => {


  test('should show existing bookmarked post', async ({ page }) => {

    await expect(
      page.locator('#bookmarkList')
    )
    .toContainText('Lunch Hangout');

  });


  test('bookmarked post should show author', async ({ page }) => {

    await expect(
      page.locator('#bookmarkList')
    )
    .toContainText('@Daniel Lee');

  });


  test('bookmarked post should show location', async ({ page }) => {

    await expect(
      page.locator('#bookmarkList')
    )
    .toContainText('SP Food Court 6');

  });


  test('bookmarked post should have remove button', async ({ page }) => {

    const card = page.locator('.post-card')
      .filter({
        hasText: 'Lunch Hangout'
      });


    await expect(
      card.getByRole('button', {
        name: 'Remove'
      })
    ).toBeVisible();

  });


});




// REMOVE BOOKMARK
test.describe('Remove Bookmark', () => {


  test('should allow user to remove a bookmark', async ({ page }) => {

    page.on('dialog', dialog => dialog.accept());


    const card = page.locator('.post-card')
      .filter({
        hasText: 'Lunch Hangout'
      });


    await card.getByRole('button', {
      name: 'Remove'
    }).click();


    await expect(
      page.locator('#bookmarkList')
    )
    .not
    .toContainText('Lunch Hangout');

  });


});




// EMPTY STATE
test.describe('Bookmark Empty State', () => {


  test('should show empty state when user has no bookmarks', async ({ page }) => {

    // Remove all Sarah bookmarks directly from database
    await pool.query(
      `
      DELETE FROM bookmarked_posts
      WHERE user_id = $1
      `,
      [SARAH_ID]
    );


    await page.reload();


    await expect(
      page.locator('#bookmarkList')
    )
    .toContainText('No bookmarks yet');

  });


});