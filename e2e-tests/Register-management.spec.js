require("dotenv").config({ path: ".env.test" });

const { test, expect } = require("@playwright/test");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BASE_URL = "http://localhost:3001";

function uniqueEmail(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@ichat.sp.edu.sg`;
}

const createdEmails = [];

async function fillRegisterForm(page, { username, email, password, confirmPassword, acceptTerms = true }) {
  if (username !== undefined) await page.locator("#username").fill(username);
  if (email !== undefined) await page.locator("#email").fill(email);
  if (password !== undefined) await page.locator("#password").fill(password);
  if (confirmPassword !== undefined) await page.locator("#confirmPassword").fill(confirmPassword);
  if (acceptTerms) await page.locator("#terms").check();
}

test.afterAll(async () => {
  if (createdEmails.length > 0) {
    await pool.query(`DELETE FROM users WHERE student_email = ANY($1);`, [createdEmails]);
  }
  await pool.end();
});

test.describe("Register Page Load", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/register.html`);
    await page.waitForSelector("#signupForm");
  });

  test("should display the register heading", async ({ page }) => {
    await expect(page.locator(".register-heading")).toContainText("crew");
  });

  test("should display the create account button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Create My Account" })).toBeVisible();
  });

  test("should display all required form fields", async ({ page }) => {
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();
  });
});

test.describe("Submit Registration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/register.html`);
    await page.waitForSelector("#signupForm");
  });

  test("should register successfully and redirect to login", async ({ page }) => {
    const email = uniqueEmail("register_success");
    createdEmails.push(email);

    await fillRegisterForm(page, {
      username: "New Student",
      email,
      password: "StrongPass123",
      confirmPassword: "StrongPass123"
    });

    await page.getByRole("button", { name: "Create My Account" }).click();

    await page.waitForURL(/login\.html/);
    expect(page.url()).toContain("login.html");
  });

  test("should show a warning for a duplicate email", async ({ page }) => {
    const email = uniqueEmail("register_duplicate");
    createdEmails.push(email);

    const registerResponse = await page.request.post(`${BASE_URL}/auth/register`, {
      data: {
        student_name: "Existing Student",
        student_email: email,
        password: "StrongPass123"
      }
    });
    expect(registerResponse.status()).toBeLessThan(300);

    await fillRegisterForm(page, {
      username: "Existing Student",
      email,
      password: "StrongPass123",
      confirmPassword: "StrongPass123"
    });

    await page.getByRole("button", { name: "Create My Account" }).click();

    await expect(page.locator("#warningText")).toContainText(/already exists/i);
    expect(page.url()).toContain("register.html");
  });

  test("should show a warning when username is missing", async ({ page }) => {
    await fillRegisterForm(page, {
      username: "",
      email: uniqueEmail("register_no_username"),
      password: "StrongPass123",
      confirmPassword: "StrongPass123"
    });

    await page.getByRole("button", { name: "Create My Account" }).click();

    await expect(page.locator("#warningText")).toContainText(/all fields are required/i);
  });

  test("should show a warning when passwords do not match", async ({ page }) => {
    await fillRegisterForm(page, {
      username: "Mismatch User",
      email: uniqueEmail("register_mismatch"),
      password: "StrongPass123",
      confirmPassword: "DifferentPass456"
    });

    await page.getByRole("button", { name: "Create My Account" }).click();

    await expect(page.locator("#warningText")).toContainText(/passwords do not match/i);
  });
});