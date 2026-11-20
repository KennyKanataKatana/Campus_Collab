require("dotenv").config({ path: ".env.test" });

const { test, expect } = require("@playwright/test");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BASE_URL = "http://localhost:3001";

const jwtSecret = process.env.JWT_SECRET_KEY || "test-jwt-secret";
const jwtAlgorithm = process.env.JWT_ALGORITHM || "HS256";

const APPEAL_PASSKEY = process.env.REPORT_PASSKEY || "campuscollab123";

let appellantId;
let reporterId;

function createToken(userId) {
  return jwt.sign({ userId }, jwtSecret, {
    algorithm: jwtAlgorithm,
    expiresIn: "1h"
  });
}

async function gotoAppealPage(page, { userId } = {}) {
  if (userId) {
    const token = createToken(userId);
    await page.addInitScript(
      ({ sessionToken }) => {
        localStorage.setItem("token", sessionToken);
      },
      { sessionToken: token }
    );
  }

  await page.goto(`${BASE_URL}/appeal.html`);
  await page.waitForSelector("#appealForm");
}

async function unlockAppeals(page) {
  await page.locator("#appealPasskey").fill(APPEAL_PASSKEY);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.locator("#appealsSection")).toBeVisible();
}

async function resetDatabase() {
  await pool.query(
    `
    DELETE FROM appeals
    WHERE user_id IN ($1, $2)
    `,
    [appellantId, reporterId]
  );

  await pool.query(
    `
    DELETE FROM reports
    WHERE reporter_id IN ($1, $2)
       OR reported_user_id IN ($1, $2)
    `,
    [appellantId, reporterId]
  );
}

async function insertReceivedReportForAppellant() {
  const result = await pool.query(
    `
    INSERT INTO reports (reporter_id, reported_user_id, incident_area, reason)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [reporterId, appellantId, "Forum Page", "Seeded report for appeal e2e tests"]
  );

  return result.rows[0].id;
}

test.beforeAll(async () => {
  const appellantResult = await pool.query(
    `
    INSERT INTO users (student_name, student_email, password_hash)
    VALUES ('Appeal E2E Appellant', 'appeal_e2e_appellant@ichat.sp.edu.sg', 'hashedpassword')
    RETURNING id;
    `
  );

  const reporterResult = await pool.query(
    `
    INSERT INTO users (student_name, student_email, password_hash)
    VALUES ('Appeal E2E Reporter', 'appeal_e2e_reporter@ichat.sp.edu.sg', 'hashedpassword')
    RETURNING id;
    `
  );

  appellantId = appellantResult.rows[0].id;
  reporterId = reporterResult.rows[0].id;
});

test.beforeEach(async () => {
  await resetDatabase();
});

test.afterEach(async () => {
  await resetDatabase();
});

test.afterAll(async () => {
  await resetDatabase();

  await pool.query(
    `
    DELETE FROM users
    WHERE id IN ($1, $2);
    `,
    [appellantId, reporterId]
  );

  await pool.end();
});

test.describe("Appeal Page Load", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAppealPage(page, { userId: appellantId });
  });

  test("should display appeal page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Submit an Appeal", exact: true })
    ).toBeVisible();
  });

  test("should display submit appeal button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Submit Appeal" })).toBeVisible();
  });

  test("should display unlock appeals button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Unlock" })).toBeVisible();
  });

  test("should hide warning and success cards by default", async ({ page }) => {
    await expect(page.locator("#warningCard")).toBeHidden();
    await expect(page.locator("#successCard")).toBeHidden();
  });

  test("should hide appeals section until unlocked", async ({ page }) => {
    await expect(page.locator("#appealsSection")).toBeHidden();
    await expect(page.locator("#appealsGateMessage")).toContainText(/appeals are hidden/i);
  });
});

test.describe("My Received Reports Dropdown", () => {
  test("should populate the report dropdown with reports the user received", async ({ page }) => {
    const seededReportId = await insertReceivedReportForAppellant();

    await gotoAppealPage(page, { userId: appellantId });

    const options = page.locator("#appealReportId option");
    const values = await options.evaluateAll((nodes) => nodes.map((n) => n.value));

    expect(values).toContain(String(seededReportId));
  });

  test("should only show the general option when the user has no received reports", async ({
    page
  }) => {
    await gotoAppealPage(page, { userId: appellantId });

    const options = page.locator("#appealReportId option");

    await expect(options).toHaveCount(1);
    await expect(options.first()).toHaveText(/not sure.*general appeal/i);
  });

  test("should not populate the dropdown when the user is not logged in", async ({ page }) => {
    await gotoAppealPage(page);

    const options = page.locator("#appealReportId option");

    await expect(options).toHaveCount(1);
  });
});

test.describe("Submit Appeal", () => {
  test("should allow user to submit an appeal referencing a specific report", async ({ page }) => {
    const seededReportId = await insertReceivedReportForAppellant();

    await gotoAppealPage(page, { userId: appellantId });

    await page.locator("#appealReportId").selectOption(String(seededReportId));
    await page.locator("#appealReason").fill("I was not the one who did this.");
    await page.locator("#agreeAppealRules").check();

    await page.getByRole("button", { name: "Submit Appeal" }).click();

    await expect(page.locator("#successCard")).toBeVisible();
    await expect(page.locator("#successText")).toContainText(/appeal submitted successfully/i);
  });

  test("should allow user to submit a general appeal without selecting a report", async ({
    page
  }) => {
    await gotoAppealPage(page, { userId: appellantId });

    await page.locator("#appealReason").fill("General appeal, not sure which report caused this.");
    await page.locator("#agreeAppealRules").check();

    await page.getByRole("button", { name: "Submit Appeal" }).click();

    await expect(page.locator("#successCard")).toBeVisible();
    await expect(page.locator("#warningCard")).toBeHidden();
  });

  test("should show a warning when the user is not logged in", async ({ page }) => {
    await gotoAppealPage(page);

    await page.locator("#appealReason").fill("Trying to appeal while logged out.");
    await page.locator("#agreeAppealRules").check();

    await page.getByRole("button", { name: "Submit Appeal" }).click();

    await expect(page.locator("#successCard")).toBeHidden();
    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/log in/i);
  });

  test("should show a warning when reason is only whitespace", async ({ page }) => {
    await gotoAppealPage(page, { userId: appellantId });

    await page.locator("#appealReason").fill("   ");
    await page.locator("#agreeAppealRules").check();

    await page.getByRole("button", { name: "Submit Appeal" }).click();

    await expect(page.locator("#successCard")).toBeHidden();
    await expect(page.locator("#warningCard")).toBeVisible();
    await expect(page.locator("#warningText")).toContainText(/explain your appeal/i);
  });

  test("should not submit when reason is left blank (native validation)", async ({ page }) => {
    await gotoAppealPage(page, { userId: appellantId });

    await page.locator("#agreeAppealRules").check();
    await page.getByRole("button", { name: "Submit Appeal" }).click();

    const isValid = await page.locator("#appealReason").evaluate((el) => el.checkValidity());

    expect(isValid).toBe(false);
    await expect(page.locator("#successCard")).toBeHidden();
  });

  test("should not submit when rules checkbox is unchecked (native validation)", async ({
    page
  }) => {
    await gotoAppealPage(page, { userId: appellantId });

    await page.locator("#appealReason").fill("Explanation without agreeing to rules.");
    await page.getByRole("button", { name: "Submit Appeal" }).click();

    const isValid = await page
      .locator("#agreeAppealRules")
      .evaluate((el) => el.checkValidity());

    expect(isValid).toBe(false);
    await expect(page.locator("#successCard")).toBeHidden();
  });
});

test.describe("Unlock Appeals", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAppealPage(page, { userId: appellantId });
  });

  test("should unlock appeals with correct passkey", async ({ page }) => {
    await unlockAppeals(page);

    await expect(page.locator("#appealsGateMessage")).toContainText(/passkey accepted/i);
    await expect(page.locator("#appealsSection")).toBeVisible();
  });

  test("should not unlock appeals with wrong passkey", async ({ page }) => {
    await page.locator("#appealPasskey").fill("wrongpasskey");
    await page.getByRole("button", { name: "Unlock" }).click();

    await expect(page.locator("#appealsSection")).toBeHidden();
    await expect(page.locator("#appealsGateMessage")).toContainText(/wrong passkey|hidden/i);
  });

  test("should show a message when passkey field is left empty", async ({ page }) => {
    await page.locator("#appealPasskey").fill("");
    await page.getByRole("button", { name: "Unlock" }).click();

    await expect(page.locator("#appealsSection")).toBeHidden();
    await expect(page.locator("#appealsGateMessage")).toContainText(/enter the passkey/i);
  });

  test("should reveal the passkey as text when show passkey is checked", async ({ page }) => {
    await expect(page.locator("#appealPasskey")).toHaveAttribute("type", "password");

    await page.locator("#showAppealPasskey").check();

    await expect(page.locator("#appealPasskey")).toHaveAttribute("type", "text");

    await page.locator("#showAppealPasskey").uncheck();

    await expect(page.locator("#appealPasskey")).toHaveAttribute("type", "password");
  });
});

test.describe("View Submitted Appeals", () => {
  test("should show submitted appeal in admin list after unlock", async ({ page }) => {
    await gotoAppealPage(page, { userId: appellantId });

    await page.locator("#appealReason").fill("Repeated spam links were not actually mine.");
    await page.locator("#agreeAppealRules").check();

    await page.getByRole("button", { name: "Submit Appeal" }).click();
    await expect(page.locator("#successCard")).toBeVisible();

    await unlockAppeals(page);

    await expect(page.locator("#appealsList")).toContainText("Repeated spam links were not actually mine.");
    await expect(page.locator("#appealsList")).toContainText(/PENDING/i);
  });
});

test.describe("Appeals API Access Control", () => {
  test("should reject POST /appeals with no auth token", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/appeals`, {
      data: { reason: "No token provided" }
    });

    expect(response.status()).toBe(401);
  });

  test("should reject GET /appeals with no passkey header", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/appeals`);

    expect(response.status()).toBe(401);
  });

  test("should reject GET /appeals with wrong passkey header", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/appeals`, {
      headers: { "x-report-passkey": "wrongpasskey" }
    });

    expect(response.status()).toBe(403);
  });
});