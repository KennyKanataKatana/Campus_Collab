require("dotenv").config({
    path: "../.env.test"
});

const { test, expect } = require("@playwright/test");

const BASE_URL = "http://127.0.0.1:3001";

const USER = {
    email: "sarahlim.23@ichat.sp.edu.sg",
    password: "password123"
};


// =====================================================
// LOGIN HELPER
// =====================================================

async function login(page) {

    await page.goto(`${BASE_URL}/login.html`);


    // Close journey popup if it appears
    const popupButton = page.locator("#closeJourneyPopupButton");

    if (await popupButton.isVisible()) {
        await popupButton.click();
    }


    await page.fill("#email", USER.email);
    await page.fill("#password", USER.password);


    await page.getByRole("button", {
        name: "Let's Go"
    }).click();


    await page.waitForURL(/index\.html/, {
        timeout: 10000
    });


    await page.waitForLoadState("networkidle");

}


// =====================================================
// SETUP
// =====================================================

test.beforeEach(async ({ page }) => {

    await login(page);

    await page.goto(`${BASE_URL}/postHistory.html`);

    await page.waitForLoadState("networkidle");

});


// =====================================================
// PAGE LOAD
// =====================================================

test.describe("Post History Page Load", () => {

    test("should display page title", async ({ page }) => {

        await expect(
            page.getByRole("heading", {
                name: /Post History/i
            })
        ).toBeVisible();

    });


    test("should display history container", async ({ page }) => {

        await expect(
            page.locator("#historyContainer")
        ).toBeVisible();

    });


    test("should display archived post counter", async ({ page }) => {

        await expect(
            page.locator(".history-count")
        ).toBeVisible();

    });

});


// =====================================================
// HISTORY CONTENT
// =====================================================

test.describe("History Content", () => {

    test("should display delete history button if history exists", async ({ page }) => {

        const deleteButtons = page.locator(".delete-btn");

        if (await deleteButtons.count() > 0) {

            await expect(
                deleteButtons.first()
            ).toBeVisible();

        } else {

            await expect(
                page.locator("#historyContainer")
            ).toBeVisible();

        }

    });


    test("history container should not be empty", async ({ page }) => {

        await expect(
            page.locator("#historyContainer")
        ).not.toBeEmpty();

    });

});