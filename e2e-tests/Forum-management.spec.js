require("dotenv").config({ path: ".env.test" });

const { test, expect } = require("@playwright/test");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BASE_URL = "http://localhost:3001";

const jwtSecret = process.env.JWT_SECRET_KEY || "jakalantern";
const jwtAlgorithm = process.env.JWT_ALGORITHM || "HS256";

// The create-thread form's location dropdown is static HTML (options 1-5),
// not populated dynamically, so thread creation via the UI must use one of
// these hardcoded ids. Assumes your seed script's first location has id 1.
const SEEDED_LOCATION_ID = 1;

let authorId;
let otherUserId;

function createToken(userId) {
  return jwt.sign({ userId }, jwtSecret, {
    algorithm: jwtAlgorithm,
    expiresIn: "1h"
  });
}

async function gotoForumPage(page, { userId, studentName } = {}) {
  if (userId) {
    const token = createToken(userId);
    await page.addInitScript(
      ({ sessionToken, sessionName, sessionUserId }) => {
        localStorage.setItem("token", sessionToken);
        localStorage.setItem("student_name", sessionName);
        localStorage.setItem("userId", String(sessionUserId));
      },
      { sessionToken: token, sessionName: studentName || "", sessionUserId: userId }
    );
  }

  await page.goto(`${BASE_URL}/forum.html`);
  await page.waitForSelector("#createThreadForm");
}

async function resetDatabase() {
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
    DELETE FROM friend_requests
    WHERE sender_id IN ($1, $2) OR receiver_id IN ($1, $2);
    `,
    [authorId, otherUserId]
  );
}

async function insertThread({ userId, title, content, imageUrl = null, videoUrl = null }) {
  const result = await pool.query(
    `
    INSERT INTO forum_threads (user_id, location_id, title, content, image_url, video_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
    `,
    [userId, SEEDED_LOCATION_ID, title, content, imageUrl, videoUrl]
  );

  return result.rows[0].id;
}

test.beforeAll(async () => {
  const authorResult = await pool.query(
    `
    INSERT INTO users (student_name, student_email, password_hash)
    VALUES ('Forum E2E Author', 'forum_e2e_author@ichat.sp.edu.sg', 'hashedpassword')
    RETURNING id;
    `
  );

  const otherUserResult = await pool.query(
    `
    INSERT INTO users (student_name, student_email, password_hash)
    VALUES ('Forum E2E Other', 'forum_e2e_other@ichat.sp.edu.sg', 'hashedpassword')
    RETURNING id;
    `
  );

  authorId = authorResult.rows[0].id;
  otherUserId = otherUserResult.rows[0].id;
});

test.beforeEach(async () => {
  await resetDatabase();
});

test.afterEach(async () => {
  await resetDatabase();
});

test.afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2);`, [authorId, otherUserId]);
  await pool.end();
});

test.describe("Forum Page Load", () => {
  test.beforeEach(async ({ page }) => {
    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });
  });

  test("should display forum page heading", async ({ page }) => {
    await expect(page.locator(".page-title")).toContainText("Forum");
  });

  test("should display the create thread form", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Post Thread" })).toBeVisible();
  });

  test("should hide the warning card by default", async ({ page }) => {
    await expect(page.locator("#warningCard")).toBeHidden();
  });

  test("should render the All Locations filter pill", async ({ page }) => {
    await expect(page.locator('.mini-pill[data-location-id="all"]')).toBeVisible();
  });
});

test.describe("Load Threads", () => {
  test("should display a seeded thread with author and location", async ({ page }) => {
    await insertThread({
      userId: authorId,
      title: "My first forum post",
      content: "Anyone free to study later?"
    });

    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });

    const threadCard = page.locator(".forum-card").filter({ hasText: "My first forum post" });

    await expect(threadCard).toBeVisible();
    await expect(threadCard).toContainText("Forum E2E Author");
    await expect(threadCard).toContainText("Anyone free to study later?");
  });
});

test.describe("Create Thread", () => {
  test("should create a thread successfully", async ({ page }) => {
    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });

    await page.locator("#threadTitle").fill("New thread title");
    await page.locator("#threadLocation").selectOption(String(SEEDED_LOCATION_ID));
    await page.locator("#threadMsg").fill("New thread content here.");

    await page.getByRole("button", { name: "Post Thread" }).click();

    await expect(page.locator(".forum-card").filter({ hasText: "New thread title" })).toBeVisible();
  });

  test("should show a warning when not logged in", async ({ page }) => {
    await gotoForumPage(page);

    await page.locator("#threadTitle").fill("Anonymous thread");
    await page.locator("#threadLocation").selectOption(String(SEEDED_LOCATION_ID));
    await page.locator("#threadMsg").fill("Trying to post while logged out.");

    await page.getByRole("button", { name: "Post Thread" }).click();

    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/log in/i);
  });

  test("should show a warning when required fields are missing", async ({ page }) => {
    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });

    await page.locator("#threadTitle").fill("Missing content thread");
    await page.locator("#threadLocation").selectOption(String(SEEDED_LOCATION_ID));

    await page.getByRole("button", { name: "Post Thread" }).click();

    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/fill in all thread fields/i);
  });

  test("should show a warning for an invalid image url", async ({ page }) => {
    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });

    await page.locator("#threadTitle").fill("Bad image thread");
    await page.locator("#threadLocation").selectOption(String(SEEDED_LOCATION_ID));
    await page.locator("#threadMsg").fill("Has a bad image link.");
    await page.locator("#threadImageUrl").fill("not-a-url");

    await page.getByRole("button", { name: "Post Thread" }).click();

    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/image link/i);
  });

  test("should show a warning for an invalid video url", async ({ page }) => {
    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });

    await page.locator("#threadTitle").fill("Bad video thread");
    await page.locator("#threadLocation").selectOption(String(SEEDED_LOCATION_ID));
    await page.locator("#threadMsg").fill("Has a bad video link.");
    await page.locator("#threadVideoUrl").fill("not-a-url");

    await page.getByRole("button", { name: "Post Thread" }).click();

    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/video link/i);
  });
});

test.describe("Reply to Thread", () => {
  test("should submit a reply successfully", async ({ page }) => {
    const threadId = await insertThread({
      userId: authorId,
      title: "Thread for replies",
      content: "Reply to me please."
    });

    await gotoForumPage(page, { userId: otherUserId, studentName: "Forum E2E Other" });

    const replyForm = page.locator(`.reply-form[data-thread-id="${threadId}"]`);
    await replyForm.locator(".reply-input").fill("Here is my reply.");
    await replyForm.getByRole("button", { name: "Reply" }).click();

    await expect(page.locator(`#replies-${threadId}`)).toContainText("Here is my reply.");
  });

  test("should not submit an empty reply (native validation)", async ({ page }) => {
    const threadId = await insertThread({
      userId: authorId,
      title: "Thread for empty reply",
      content: "Try replying with nothing."
    });

    await gotoForumPage(page, { userId: otherUserId, studentName: "Forum E2E Other" });

    const replyForm = page.locator(`.reply-form[data-thread-id="${threadId}"]`);
    await replyForm.getByRole("button", { name: "Reply" }).click();

    const isValid = await replyForm.locator(".reply-input").evaluate((el) => el.checkValidity());

    expect(isValid).toBe(false);
  });
});

test.describe("Delete Thread", () => {
  test("should show a delete button only for the thread owner", async ({ page }) => {
    await insertThread({
      userId: authorId,
      title: "Owned thread",
      content: "This belongs to the author."
    });

    await gotoForumPage(page, { userId: otherUserId, studentName: "Forum E2E Other" });

    const threadCard = page.locator(".forum-card").filter({ hasText: "Owned thread" });

    await expect(threadCard.locator(".delete-thread-btn")).toHaveCount(0);
  });

  test("should delete the thread when the owner confirms", async ({ page }) => {
    await insertThread({
      userId: authorId,
      title: "Thread to delete",
      content: "This will be deleted."
    });

    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });

    page.once("dialog", (dialog) => dialog.accept());

    const threadCard = page.locator(".forum-card").filter({ hasText: "Thread to delete" });
    await threadCard.locator(".delete-thread-btn").click();

    await expect(page.locator(".forum-card").filter({ hasText: "Thread to delete" })).toHaveCount(0);
  });

  test("should not delete the thread when the confirm dialog is cancelled", async ({ page }) => {
    await insertThread({
      userId: authorId,
      title: "Thread to keep",
      content: "This should survive."
    });

    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });

    page.once("dialog", (dialog) => dialog.dismiss());

    const threadCard = page.locator(".forum-card").filter({ hasText: "Thread to keep" });
    await threadCard.locator(".delete-thread-btn").click();

    await expect(page.locator(".forum-card").filter({ hasText: "Thread to keep" })).toBeVisible();
  });
});

test.describe("Voting", () => {
  test("should like a thread", async ({ page }) => {
    const threadId = await insertThread({
      userId: authorId,
      title: "Thread to like",
      content: "Like me please."
    });

    await gotoForumPage(page, { userId: otherUserId, studentName: "Forum E2E Other" });

    const voteBar = page.locator(`.vote-bar[data-thread-id="${threadId}"]`);
    await voteBar.locator(".like-btn").click();

    await expect(page.locator(`.forum-card[data-thread-id="${threadId}"] .like-btn`)).toHaveClass(
      /active/
    );
  });

  test("should switch a vote from like to dislike", async ({ page }) => {
    const threadId = await insertThread({
      userId: authorId,
      title: "Thread to switch vote",
      content: "Change your mind here."
    });

    await gotoForumPage(page, { userId: otherUserId, studentName: "Forum E2E Other" });

    const voteBar = page.locator(`.vote-bar[data-thread-id="${threadId}"]`);
    await voteBar.locator(".like-btn").click();
    await expect(page.locator(`.forum-card[data-thread-id="${threadId}"] .like-btn`)).toHaveClass(
      /active/
    );

    await page.locator(`.vote-bar[data-thread-id="${threadId}"] .dislike-btn`).click();

    await expect(
      page.locator(`.forum-card[data-thread-id="${threadId}"] .dislike-btn`)
    ).toHaveClass(/active/);
    await expect(page.locator(`.forum-card[data-thread-id="${threadId}"] .like-btn`)).not.toHaveClass(
      /active/
    );
  });

  test("should remove a vote when clicking the active vote again", async ({ page }) => {
    const threadId = await insertThread({
      userId: authorId,
      title: "Thread to unvote",
      content: "Toggle me off."
    });

    await gotoForumPage(page, { userId: otherUserId, studentName: "Forum E2E Other" });

    const voteBar = page.locator(`.vote-bar[data-thread-id="${threadId}"]`);
    await voteBar.locator(".like-btn").click();
    await expect(page.locator(`.forum-card[data-thread-id="${threadId}"] .like-btn`)).toHaveClass(
      /active/
    );

    await page.locator(`.vote-bar[data-thread-id="${threadId}"] .like-btn`).click();

    await expect(page.locator(`.forum-card[data-thread-id="${threadId}"] .like-btn`)).not.toHaveClass(
      /active/
    );
  });
});

test.describe("Search and Filters", () => {
  test("should filter threads by search term", async ({ page }) => {
    await insertThread({
      userId: authorId,
      title: "Unique searchable title",
      content: "Some content"
    });

    await insertThread({
      userId: authorId,
      title: "Totally different post",
      content: "Other content"
    });

    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });

    await page.locator("#forumSearchInput").fill("Unique searchable");

    await expect(
      page.locator(".forum-card").filter({ hasText: "Unique searchable title" })
    ).toBeVisible();
    await expect(
      page.locator(".forum-card").filter({ hasText: "Totally different post" })
    ).toHaveCount(0);
  });

  test("should show only the caller's own posts when Your Posts is active", async ({ page }) => {
    await insertThread({
      userId: authorId,
      title: "My own thread",
      content: "Mine"
    });

    await insertThread({
      userId: otherUserId,
      title: "Someone elses thread",
      content: "Not mine"
    });

    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });

    await page.getByRole("button", { name: "Your Posts" }).click();

    await expect(page.locator(".forum-card").filter({ hasText: "My own thread" })).toBeVisible();
    await expect(
      page.locator(".forum-card").filter({ hasText: "Someone elses thread" })
    ).toHaveCount(0);
  });

  test("should show a warning when Your Posts is clicked while not logged in", async ({ page }) => {
    await gotoForumPage(page);

    await page.getByRole("button", { name: "Your Posts" }).click();

    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/log in/i);
  });

  test("should show a warning when Friends Only is clicked while not logged in", async ({ page }) => {
    await gotoForumPage(page);

    await page.getByRole("button", { name: "Friends Only" }).click();

    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/log in/i);
  });

  test("should show only friends' posts when Friends Only is active", async ({ page }) => {
    await pool.query(
      `
      INSERT INTO friend_requests (sender_id, receiver_id, status)
      VALUES ($1, $2, 'ACCEPTED');
      `,
      [authorId, otherUserId]
    );

    await insertThread({
      userId: otherUserId,
      title: "Friend post",
      content: "From a friend"
    });

    await insertThread({
      userId: authorId,
      title: "My own separate thread",
      content: "Not from a friend"
    });

    await gotoForumPage(page, { userId: authorId, studentName: "Forum E2E Author" });

    await page.getByRole("button", { name: "Friends Only" }).click();

    await expect(page.locator(".forum-card").filter({ hasText: "Friend post" })).toBeVisible();
    await expect(
      page.locator(".forum-card").filter({ hasText: "My own separate thread" })
    ).toHaveCount(0);
  });
});

test.describe("Forum API Access Control", () => {
  test("should reject POST /forum with no auth token", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/forum`, {
      data: { location_id: SEEDED_LOCATION_ID, title: "T", content: "C" }
    });

    expect(response.status()).toBe(401);
  });

  test("should reject POST /forum/:thread_id/replies with no auth token", async ({ request }) => {
    const threadId = await insertThread({
      userId: authorId,
      title: "Thread for reply access control",
      content: "Testing reply auth"
    });

    const response = await request.post(`${BASE_URL}/forum/${threadId}/replies`, {
      data: { content: "Should not work." }
    });

    expect(response.status()).toBe(401);
  });

  test("should reject GET /forum/:thread_id/replies with no auth token", async ({ request }) => {
    const threadId = await insertThread({
      userId: authorId,
      title: "Thread for reading replies access control",
      content: "Testing read auth"
    });

    const response = await request.get(`${BASE_URL}/forum/${threadId}/replies`);

    expect(response.status()).toBe(401);
  });

  test("should reject POST /forum/:thread_id/vote with no auth token", async ({ request }) => {
    const threadId = await insertThread({
      userId: authorId,
      title: "Thread for vote access control",
      content: "Testing vote auth"
    });

    const response = await request.post(`${BASE_URL}/forum/${threadId}/vote`, {
      data: { vote_type: "LIKE" }
    });

    expect(response.status()).toBe(401);
  });

  test("should reject DELETE /forum/:thread_id/vote with no auth token", async ({ request }) => {
    const threadId = await insertThread({
      userId: authorId,
      title: "Thread for remove-vote access control",
      content: "Testing remove vote auth"
    });

    const response = await request.delete(`${BASE_URL}/forum/${threadId}/vote`);

    expect(response.status()).toBe(401);
  });

  test("should reject DELETE /forum/:thread_id with no auth token", async ({ request }) => {
    const threadId = await insertThread({
      userId: authorId,
      title: "Thread for delete access control",
      content: "Testing delete auth"
    });

    const response = await request.delete(`${BASE_URL}/forum/${threadId}`);

    expect(response.status()).toBe(401);
  });
});