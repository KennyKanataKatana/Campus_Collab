require("dotenv").config({ path: ".env.test" });

const { test, expect } = require("@playwright/test");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BASE_URL = "http://localhost:3001";

const jwtSecret = process.env.JWT_SECRET_KEY || "jakalantern";
const jwtAlgorithm = process.env.JWT_ALGORITHM || "HS256";

const REPORT_PASSKEY = process.env.REPORT_PASSKEY || "campuscollab123";

const SARAH_ID = 1;
const AMANDA_ID = 3;
const JOHN_ID = 4;

const SARAH_NAME = "Sarah Lim";
const JOHN_NAME = "John Tan";

function createToken(userId) {
  return jwt.sign({ userId }, jwtSecret, {
    algorithm: jwtAlgorithm,
    expiresIn: "1h"
  });
}

// Injects a JWT + student_name directly into localStorage instead of
// driving the real login form. Removes login-endpoint load (bcrypt, DB
// round trips) from every single test in this file.
async function gotoReportPage(page, { userId, studentName } = {}) {
  if (userId) {
    const token = createToken(userId);
    await page.addInitScript(
      ({ sessionToken, sessionName }) => {
        localStorage.setItem("token", sessionToken);
        localStorage.setItem("student_name", sessionName);
      },
      { sessionToken: token, sessionName: studentName }
    );
  }

  await page.goto(`${BASE_URL}/report.html`);
  await page.waitForSelector("#reportForm");
}

async function unlockReports(page) {
  await page.locator("#reportPasskey").fill(REPORT_PASSKEY);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.locator("#reportsSection")).toBeVisible();
}

async function resetDatabase() {
  await pool.query(
    `
    DELETE FROM reports
    WHERE reporter_id IN ($1, $2, $3)
       OR reported_user_id IN ($1, $2, $3)
    `,
    [SARAH_ID, AMANDA_ID, JOHN_ID]
  );

  await pool.query(
    `
    UPDATE users
    SET is_muted = FALSE,
        muted_at = NULL,
        mute_until = NULL,
        muted_reason = NULL
    WHERE id IN ($1, $2, $3)
    `,
    [SARAH_ID, AMANDA_ID, JOHN_ID]
  );
}

// Inserts a report directly via SQL instead of relying on the global DB
// seeder, since resetDatabase() (run in beforeEach) wipes any seeded
// reports touching SARAH_ID/AMANDA_ID/JOHN_ID before tests even start.
async function insertDirectReport({ reporterId, reportedUserId, incidentArea, reason }) {
  const result = await pool.query(
    `
    INSERT INTO reports (reporter_id, reported_user_id, incident_area, reason)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [reporterId, reportedUserId, incidentArea, reason]
  );

  return result.rows[0].id;
}

test.beforeEach(async () => {
  await resetDatabase();
});

test.afterEach(async () => {
  await resetDatabase();
});

test.afterAll(async () => {
  await pool.end();
});

test.describe("Report Page Load", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReportPage(page, { userId: SARAH_ID, studentName: SARAH_NAME });
  });

  test("should display report page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Report a User", exact: true })
    ).toBeVisible();
  });

  test("should display submit report button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Send Report" })).toBeVisible();
  });

  test("should display unlock reports button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Unlock" })).toBeVisible();
  });

  test("should hide warning and success cards by default", async ({ page }) => {
    await expect(page.locator("#warningCard")).toBeHidden();
    await expect(page.locator("#successCard")).toBeHidden();
  });

  test("should hide reports section until unlocked", async ({ page }) => {
    await expect(page.locator("#reportsSection")).toBeHidden();
    await expect(page.locator("#reportsGateMessage")).toContainText(
      /reports are hidden/i
    );
  });
});

test.describe("Reportable Users", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReportPage(page, { userId: SARAH_ID, studentName: SARAH_NAME });
  });

  test("should load datalist options for users", async ({ page }) => {
    const options = page.locator("#studentNames option");
    await expect(options.first()).toBeAttached();
  });

  test("should list seeded users by name in the datalist", async ({ page }) => {
    const options = page.locator("#studentNames option");
    const values = await options.evaluateAll((nodes) => nodes.map((n) => n.value));

    expect(values).toContain(SARAH_NAME);
    expect(values).toContain(JOHN_NAME);
  });
});

test.describe("Submit Report", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReportPage(page, { userId: SARAH_ID, studentName: SARAH_NAME });
  });

  test("should allow user to submit a report", async ({ page }) => {
    await page.locator("#reportedStudentName").fill(JOHN_NAME);
    await page.locator("#incidentArea").selectOption("Forum Page");
    await page.locator("#reason").selectOption("Spam");
    await page.locator("#details").fill("Posting repeated spam links in forum.");
    await page.locator("#proofImageUrl").fill("https://example.com/proof.png");
    await page.locator("#agreeRules").check();

    await page.getByRole("button", { name: "Send Report" }).click();

    await expect(page.locator("#successCard")).toBeVisible();
    await expect(page.locator("#successText")).toContainText(
      /User reported successfully|Report submitted successfully/i
    );
  });

  test("should allow submitting a report without a proof image url", async ({ page }) => {
    await page.locator("#reportedStudentName").fill(JOHN_NAME);
    await page.locator("#incidentArea").selectOption("Post Page");
    await page.locator("#reason").selectOption("Harassment");
    await page.locator("#details").fill("No proof link provided for this report.");
    await page.locator("#agreeRules").check();

    await page.getByRole("button", { name: "Send Report" }).click();

    await expect(page.locator("#successCard")).toBeVisible();
    await expect(page.locator("#warningCard")).toBeHidden();
  });

  test("should not allow user to report self", async ({ page }) => {
    await page.locator("#reportedStudentName").fill(SARAH_NAME);
    await page.locator("#incidentArea").selectOption("Forum Page");
    await page.locator("#reason").selectOption("Spam");
    await page.locator("#details").fill("Trying to report self.");
    await page.locator("#agreeRules").check();

    await page.getByRole("button", { name: "Send Report" }).click();

    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText("You cannot report yourself");
  });

  test("should require rules checkbox before submit", async ({ page }) => {
    await page.locator("#reportedStudentName").fill(JOHN_NAME);
    await page.locator("#incidentArea").selectOption("Forum Page");
    await page.locator("#reason").selectOption("Spam");
    await page.locator("#details").fill("Rules checkbox not checked.");

    await expect(page.locator("#agreeRules")).not.toBeChecked();

    await page.getByRole("button", { name: "Send Report" }).click();

    await expect(page.locator("#successCard")).toBeHidden();
    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/agree.*rules/i);
  });

  test("should show a warning when reported username does not exist", async ({ page }) => {
    await page.locator("#reportedStudentName").fill("Nobody With This Name");
    await page.locator("#incidentArea").selectOption("General");
    await page.locator("#reason").selectOption("Other");
    await page.locator("#details").fill("Reporting a username that does not exist.");
    await page.locator("#agreeRules").check();

    await page.getByRole("button", { name: "Send Report" }).click();

    await expect(page.locator("#successCard")).toBeHidden();
    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/not found/i);
  });

  test("should not submit when required fields are left blank", async ({ page }) => {
    await page.locator("#agreeRules").check();

    await page.getByRole("button", { name: "Send Report" }).click();

    const isValid = await page
      .locator("#reportedStudentName")
      .evaluate((el) => el.checkValidity());

    expect(isValid).toBe(false);
    await expect(page.locator("#successCard")).toBeHidden();
  });
});

test.describe("Unlock Reports", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReportPage(page, { userId: SARAH_ID, studentName: SARAH_NAME });
  });

  test("should unlock reports with correct passkey", async ({ page }) => {
    await unlockReports(page);

    await expect(page.locator("#reportsGateMessage")).toContainText("Passkey accepted");
    await expect(page.locator("#reportsSection")).toBeVisible();
  });

  test("should not unlock reports with wrong passkey", async ({ page }) => {
    await page.locator("#reportPasskey").fill("wrongpasskey");
    await page.getByRole("button", { name: "Unlock" }).click();

    await expect(page.locator("#reportsSection")).toBeHidden();
    await expect(page.locator("#reportsGateMessage")).toContainText(/wrong passkey|hidden/i);
  });

  test("should show a message when passkey field is left empty", async ({ page }) => {
    await page.locator("#reportPasskey").fill("");
    await page.getByRole("button", { name: "Unlock" }).click();

    await expect(page.locator("#reportsSection")).toBeHidden();
    await expect(page.locator("#reportsGateMessage")).toContainText(/enter the passkey/i);
  });

  test("should reveal the passkey as text when show passkey is checked", async ({ page }) => {
    await expect(page.locator("#reportPasskey")).toHaveAttribute("type", "password");

    await page.locator("#showPasskey").check();

    await expect(page.locator("#reportPasskey")).toHaveAttribute("type", "text");

    await page.locator("#showPasskey").uncheck();

    await expect(page.locator("#reportPasskey")).toHaveAttribute("type", "password");
  });
});

test.describe("View Submitted Reports", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReportPage(page, { userId: SARAH_ID, studentName: SARAH_NAME });
  });

  test("should show submitted report in admin list after unlock", async ({ page }) => {
    await page.locator("#reportedStudentName").fill(JOHN_NAME);
    await page.locator("#incidentArea").selectOption("Forum Page");
    await page.locator("#reason").selectOption("Spam");
    await page.locator("#details").fill("Repeated spam links posted.");
    await page.locator("#agreeRules").check();

    await page.getByRole("button", { name: "Send Report" }).click();
    await expect(page.locator("#successCard")).toBeVisible();

    await unlockReports(page);

    await expect(page.locator("#reportsList")).toContainText(JOHN_NAME);
    await expect(page.locator("#reportsList")).toContainText("Forum Page");
    await expect(page.locator("#reportsList")).toContainText("Spam");
  });
});

test.describe("Mute Reported User", () => {
  test.beforeEach(async ({ page }) => {
    await insertDirectReport({
      reporterId: SARAH_ID,
      reportedUserId: JOHN_ID,
      incidentArea: "Forum Page",
      reason: "Seeded report for mute tests"
    });

    await gotoReportPage(page, { userId: SARAH_ID, studentName: SARAH_NAME });
  });

  test("should allow admin to mute reported user", async ({ page }) => {
    await unlockReports(page);

    const reportCard = page.locator(".report-row").filter({ hasText: JOHN_NAME }).first();
    await expect(reportCard).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept("10"));

    await reportCard.getByRole("button", { name: "Mute Offender" }).click();

    await expect(page.locator("#successCard")).toBeVisible();
    await expect(page.locator("#successText")).toContainText(/muted successfully|has been muted/i);
    await expect(page.locator("#mutedUsersList")).toContainText(JOHN_NAME);
  });

  test("should show a warning when mute minutes input is invalid", async ({ page }) => {
    await unlockReports(page);

    const reportCard = page.locator(".report-row").filter({ hasText: JOHN_NAME }).first();
    await expect(reportCard).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept("not-a-number"));

    await reportCard.getByRole("button", { name: "Mute Offender" }).click();

    await expect(page.locator("#successCard")).toBeHidden();
    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/valid positive whole number/i);
  });

  test("should not mute user when the prompt is cancelled", async ({ page }) => {
    await unlockReports(page);

    const reportCard = page.locator(".report-row").filter({ hasText: JOHN_NAME }).first();
    await expect(reportCard).toBeVisible();

    page.once("dialog", (dialog) => dialog.dismiss());

    await reportCard.getByRole("button", { name: "Mute Offender" }).click();

    await expect(page.locator("#successCard")).toBeHidden();
    await expect(page.locator("#mutedUsersList")).not.toContainText(JOHN_NAME);
  });
});

test.describe("Unmute User", () => {
  test.beforeEach(async ({ page }) => {
    await insertDirectReport({
      reporterId: SARAH_ID,
      reportedUserId: JOHN_ID,
      incidentArea: "Forum Page",
      reason: "Seeded report for unmute tests"
    });

    await pool.query(
      `
      UPDATE users
      SET is_muted = TRUE,
          muted_at = CURRENT_TIMESTAMP,
          mute_until = CURRENT_TIMESTAMP + INTERVAL '10 minutes',
          muted_reason = 'Muted by admin'
      WHERE id = $1
      `,
      [JOHN_ID]
    );

    await gotoReportPage(page, { userId: SARAH_ID, studentName: SARAH_NAME });
  });

  test("should allow admin to unmute muted user", async ({ page }) => {
    await unlockReports(page);

    const mutedCard = page
      .locator("#mutedUsersList .report-row")
      .filter({ hasText: JOHN_NAME })
      .first();

    await expect(mutedCard).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());

    await mutedCard.getByRole("button", { name: "Unmute User" }).click();

    await expect(page.locator("#successCard")).toBeVisible();
    await expect(page.locator("#successText")).toContainText(/unmuted successfully|has been unmuted/i);
    await expect(page.locator("#mutedUsersList")).not.toContainText(JOHN_NAME);
  });

  test("should not unmute user when confirmation is cancelled", async ({ page }) => {
    await unlockReports(page);

    const mutedCard = page
      .locator("#mutedUsersList .report-row")
      .filter({ hasText: JOHN_NAME })
      .first();

    await expect(mutedCard).toBeVisible();

    page.once("dialog", (dialog) => dialog.dismiss());

    await mutedCard.getByRole("button", { name: "Unmute User" }).click();

    await expect(page.locator("#successCard")).toBeHidden();
    await expect(page.locator("#mutedUsersList")).toContainText(JOHN_NAME);
  });
});

test.describe("Muted User Restrictions", () => {
  test("should block muted user from submitting a report", async ({ page }) => {
    await pool.query(
      `
      UPDATE users
      SET is_muted = TRUE,
          muted_at = CURRENT_TIMESTAMP,
          mute_until = CURRENT_TIMESTAMP + INTERVAL '10 minutes',
          muted_reason = 'Muted by admin'
      WHERE id = $1
      `,
      [SARAH_ID]
    );

    await gotoReportPage(page, { userId: SARAH_ID, studentName: SARAH_NAME });

    await page.locator("#reportedStudentName").fill(JOHN_NAME);
    await page.locator("#incidentArea").selectOption("Forum Page");
    await page.locator("#reason").selectOption("Spam");
    await page.locator("#details").fill("Muted user should not be allowed to submit.");
    await page.locator("#agreeRules").check();

    await page.getByRole("button", { name: "Send Report" }).click();

    await expect(page.locator("#successCard")).toBeHidden();
    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/muted|cannot perform this action/i);
  });

  test("should block unauthenticated user from submitting a report", async ({ page }) => {
    await gotoReportPage(page);

    await page.locator("#reportedStudentName").fill(JOHN_NAME);
    await page.locator("#incidentArea").selectOption("Forum Page");
    await page.locator("#reason").selectOption("Spam");
    await page.locator("#details").fill("No token present at all.");
    await page.locator("#agreeRules").check();

    await page.getByRole("button", { name: "Send Report" }).click();

    await expect(page.locator("#successCard")).toBeHidden();
    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/log in/i);
  });
});

test.describe("Reports API Access Control", () => {
  test("should reject GET /reports with no passkey header", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/reports`);
    expect(response.status()).toBe(401);
  });

  test("should reject GET /reports with wrong passkey header", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/reports`, {
      headers: { "x-report-passkey": "wrongpasskey" }
    });
    expect(response.status()).toBe(403);
  });

  test("should reject PATCH mute with no passkey header", async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/reports/mute/${JOHN_ID}`, {
      data: { mute_minutes: 10 }
    });
    expect(response.status()).toBe(401);
  });

  test("should reject PATCH unmute with no passkey header", async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/reports/unmute/${JOHN_ID}`);
    expect(response.status()).toBe(401);
  });

  test("should reject POST /reports with no auth token", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/reports`, {
      data: {
        reported_student_name: JOHN_NAME,
        incident_area: "Forum Page",
        reason: "Spam"
      }
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("Reports API Coverage", () => {
  let insertedReportId;

  test.beforeEach(async () => {
    insertedReportId = await insertDirectReport({
      reporterId: SARAH_ID,
      reportedUserId: JOHN_ID,
      incidentArea: "Post Page",
      reason: "Direct API coverage report"
    });
  });

  test("should return reports filtered by reporter id", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/reports/reporter/${SARAH_ID}`, {
      headers: { "x-report-passkey": REPORT_PASSKEY }
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.some((r) => r.id === insertedReportId)).toBe(true);
  });

  test("should return reports filtered by reported user id", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/reports/reported/${JOHN_ID}`, {
      headers: { "x-report-passkey": REPORT_PASSKEY }
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.some((r) => r.id === insertedReportId)).toBe(true);
  });

  test("should return a user's own received reports via JWT", async ({ request }) => {
    const token = createToken(JOHN_ID);

    const response = await request.get(`${BASE_URL}/reports/my-received-reports`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.some((r) => r.id === insertedReportId)).toBe(true);
  });

  test("should return 404 for a reporter with no reports after cleanup", async ({ request }) => {
    await resetDatabase();

    const response = await request.get(`${BASE_URL}/reports/reporter/${AMANDA_ID}`, {
      headers: { "x-report-passkey": REPORT_PASSKEY }
    });

    expect(response.status()).toBe(404);
  });
});