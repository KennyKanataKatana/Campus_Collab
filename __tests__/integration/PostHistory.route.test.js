require("dotenv").config();

const request = require("supertest");
const app = require("../../src/app");
const pool = require("../../src/models/db");
const jwt = require("jsonwebtoken");

describe("Post History Integration Test", () => {

    let userId;
    let token;
    let historyId;

    beforeAll(async () => {

        // Create test user
        const user = await pool.query(
            `
            INSERT INTO users
            (
                student_name,
                student_email,
                password_hash
            )
            VALUES
            (
                'History User',
                'historyuser@ichat.sp.edu.sg',
                'password'
            )
            RETURNING id;
            `
        );

        userId = user.rows[0].id;

        token = jwt.sign(
            {
                userId
            },
            process.env.JWT_SECRET_KEY
        );

        // Create location
        const location = await pool.query(
            `
            INSERT INTO sp_locations
            (
                location_name
            )
            VALUES
            (
                'Library'
            )
            RETURNING id;
            `
        );

        const locationId = location.rows[0].id;

        // Create archived history
        const history = await pool.query(
            `
            INSERT INTO post_history
            (
                user_id,
                location_id,
                title,
                description,
                max_participants,
                created_at,
                archived_at
            )
            VALUES
            (
                $1,
                $2,
                'Study Group',
                'Math Revision',
                5,
                NOW(),
                NOW()
            )
            RETURNING id;
            `,
            [userId, locationId]
        );

        historyId = history.rows[0].id;

    });

    afterAll(async () => {
        await pool.end();
    });

    // =====================================================
    // GET HISTORY
    // =====================================================

    test("should retrieve user's archived posts", async () => {

        const response = await request(app)
            .get("/post-history")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);

        expect(Array.isArray(response.body)).toBe(true);

        expect(response.body[0]).toHaveProperty("title", "Study Group");

    });

    // =====================================================
    // DELETE HISTORY
    // =====================================================

    test("should delete archived history", async () => {

        const response = await request(app)
            .delete(`/post-history/${historyId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);

        const check = await pool.query(
            `
            SELECT *
            FROM post_history
            WHERE id = $1
            `,
            [historyId]
        );

        expect(check.rows.length).toBe(0);

    });

    test("should return 404 when history does not exist", async () => {

        const response = await request(app)
            .delete("/post-history/99999")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(404);

    });

});