require("dotenv").config({ path: ".env.test" });

const { test, expect } = require("@playwright/test");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BASE_URL = "http://localhost:3001";

const LOGIN_EMAIL = `login_e2e_${Date.now()}@ichat.sp.edu.sg`;
const LOGIN_PASSWORD = "StrongPass123";
const LOGIN_NAME = "Login E2E User";

async function gotoLoginPage(page) {
  await page.goto(`${BASE_URL}/login.html`);
  await page.waitForSelector("#loginForm");

  const closeButton = page.locator("#closeJourneyPopupButton");
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

test.beforeAll(async ({ request }) => {
  const response = await request.post(`${BASE_URL}/auth/register`, {
    data: {
      student_name: LOGIN_NAME,
      student_email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD
    }
  });

  expect(response.status()).toBeLessThan(300);
});

test.afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE student_email = $1;`, [LOGIN_EMAIL]);
  await pool.end();
});

test.describe("Login Page Load", () => {
  test.beforeEach(async ({ page }) => {
    await gotoLoginPage(page);
  });

  test("should display the login heading", async ({ page }) => {
    await expect(page.locator(".login-heading")).toContainText("friend");
  });

  test("should display the login button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Let's Go" })).toBeVisible();
  });

  test("should display the journey popup on load", async ({ page }) => {
    await page.goto(`${BASE_URL}/login.html`);
    await expect(page.locator("#journeyPopup")).toBeVisible();
  });
});

test.describe("Submit Login", () => {
  test.beforeEach(async ({ page }) => {
    await gotoLoginPage(page);
  });

  test("should not submit when fields are missing (native validation)", async ({ page }) => {
    await page.getByRole("button", { name: "Let's Go" }).click();

    const isEmailValid = await page.locator("#email").evaluate((el) => el.checkValidity());

    expect(isEmailValid).toBe(false);
  });

  test("should show a warning for invalid credentials", async ({ page }) => {
    await page.locator("#email").fill(LOGIN_EMAIL);
    await page.locator("#password").fill("WrongPassword999");

    await page.getByRole("button", { name: "Let's Go" }).click();

    await expect(page.locator("#warningText")).toContainText(/wrong password/i);
  });

  test("should log in successfully and redirect to index", async ({ page }) => {
    await page.locator("#email").fill(LOGIN_EMAIL);
    await page.locator("#password").fill(LOGIN_PASSWORD);

    await page.getByRole("button", { name: "Let's Go" }).click();

    await page.waitForURL(/index\.html/);
    expect(page.url()).toContain("index.html");

    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).not.toBeNull();
  });
});