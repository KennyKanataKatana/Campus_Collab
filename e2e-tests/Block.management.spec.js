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


async function login(page) {

    await page.goto(`${BASE_URL}/login.html`);


    // Close welcome popup if it appears
    const popupButton = page.locator("#closeJourneyPopupButton");

    if (await popupButton.isVisible()) {
        await popupButton.click();
    }


    await page.fill("#email", USER.email);
    await page.fill("#password", USER.password);


    await page.click('button[type="submit"]');


    await expect(page)
        .toHaveURL(/index\.html/, {
            timeout: 10000
        });
}


test.describe("Block Management", () => {


    test.afterAll(async () => {
        await pool.end();
    });



    test("should redirect unauthenticated users to login", async ({ page }) => {

        await page.goto(`${BASE_URL}/block.html`);

        await expect(page)
            .toHaveURL(/login\.html/);

    });



    test("should display Sarah's blocked users", async ({ page }) => {

        await login(page);

        await page.goto(`${BASE_URL}/block.html`);


        await expect(page.locator(".page-title"))
            .toContainText("Blocked Users");


        await expect(page.locator("#blockedList"))
            .toContainText("Amanda Koh");

    });



    test("should search for John", async ({ page }) => {

        await login(page);

        await page.goto(`${BASE_URL}/block.html`);


        await page.getByRole("button", {
            name: /\+ Block User/i
        }).click();


        const searchBox = page.locator("#search-user");


        await searchBox.click();

        await searchBox.pressSequentially("John", {
            delay: 100
        });


        await expect(page.locator("#search-results"))
            .toContainText("John Tan", {
                timeout: 10000
            });

    });



    test("should not display already blocked users in search", async ({ page }) => {

        await login(page);

        await page.goto(`${BASE_URL}/block.html`);


        await page.getByRole("button", {
            name: /\+ Block User/i
        }).click();


        const searchBox = page.locator("#search-user");


        await searchBox.click();

        await searchBox.pressSequentially("Amanda", {
            delay: 100
        });


        await expect(page.locator("#search-results"))
            .toContainText("No users found", {
                timeout: 10000
            });

    });



    test("should block John successfully", async ({ page }) => {


        // Remove John block if it exists
        await pool.query(`
            DELETE FROM blocked_users
            WHERE blocker_id = 1
            AND blocked_id = 4;
        `);



        await login(page);

        await page.goto(`${BASE_URL}/block.html`);



        // Automatically handle confirm + alert
        page.on("dialog", async dialog => {
            await dialog.accept();
        });



        await page.getByRole("button", {
            name: /\+ Block User/i
        }).click();



        const searchBox = page.locator("#search-user");


        await searchBox.click();

        await searchBox.pressSequentially("John", {
            delay: 100
        });



        await expect(page.locator("#search-results"))
            .toContainText("John Tan", {
                timeout: 10000
            });



        await page.locator("#search-results .add-btn")
            .click();



        await expect(page.locator("#blockedList"))
            .toContainText("John Tan", {
                timeout: 10000
            });



        const result = await pool.query(`
            SELECT *
            FROM blocked_users
            WHERE blocker_id = 1
            AND blocked_id = 4;
        `);



        expect(result.rowCount)
            .toBe(1);



        // Cleanup
        await pool.query(`
            DELETE FROM blocked_users
            WHERE blocker_id = 1
            AND blocked_id = 4;
        `);

    });



    test("should unblock Amanda successfully", async ({ page }) => {


        // Ensure Amanda is blocked
        await pool.query(`
            DELETE FROM blocked_users
            WHERE blocker_id = 1
            AND blocked_id = 3;

            INSERT INTO blocked_users(blocker_id, blocked_id)
            VALUES (1,3);
        `);



        await login(page);

        await page.goto(`${BASE_URL}/block.html`);



        page.on("dialog", async dialog => {
            await dialog.accept();
        });



        const amandaCard = page.locator(".blocked-card")
            .filter({
                hasText: "Amanda Koh"
            });



        await amandaCard
            .getByRole("button", {
                name: "Unblock"
            })
            .click();



        await expect(page.locator("#blockedList"))
            .not
            .toContainText("Amanda Koh", {
                timeout: 10000
            });



        const result = await pool.query(`
            SELECT *
            FROM blocked_users
            WHERE blocker_id = 1
            AND blocked_id = 3;
        `);



        expect(result.rowCount)
            .toBe(0);

    });



    test("should show no users found for invalid search", async ({ page }) => {


        await login(page);

        await page.goto(`${BASE_URL}/block.html`);



        await page.getByRole("button", {
            name: /\+ Block User/i
        }).click();



        const searchBox = page.locator("#search-user");


        await searchBox.click();


        await searchBox.pressSequentially("zzzzzzzzzz", {
            delay: 100
        });



        await expect(page.locator("#search-results"))
            .toContainText("No users found", {
                timeout: 10000
            });

    });


});