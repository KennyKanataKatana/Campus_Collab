const request = require("supertest");
const app = require("../../src/app");
const pool = require("../../src/models/db");
const jwt = require("jsonwebtoken");

describe("Block Feature Integration Test", () => {

    let userId;
    let blockedUserId;
    let token;


    beforeAll(async () => {

        const unique = Date.now();


        const user = await pool.query(
            `
            INSERT INTO users
            (
                student_name,
                student_email,
                password_hash
            )
            VALUES
            ($1,$2,$3)
            RETURNING id;
            `,
            [
                "Blocker Test",
                `blocker-${unique}@ichat.sp.edu.sg`,
                "hashedpassword"
            ]
        );


        const blockedUser = await pool.query(
            `
            INSERT INTO users
            (
                student_name,
                student_email,
                password_hash
            )
            VALUES
            ($1,$2,$3)
            RETURNING id;
            `,
            [
                "Blocked Test",
                `blocked-${unique}@ichat.sp.edu.sg`,
                "hashedpassword"
            ]
        );


        userId = user.rows[0].id;
        blockedUserId = blockedUser.rows[0].id;


        token = jwt.sign(
            {
                userId: userId
            },
            process.env.JWT_SECRET_KEY,
            {
                expiresIn: "1h"
            }
        );

    });



    afterEach(async () => {

        await pool.query(
            `
            DELETE FROM blocked_users
            WHERE blocker_id = $1;
            `,
            [
                userId
            ]
        );

    });



    afterAll(async () => {


        await pool.query(
            `
            DELETE FROM blocked_users
            WHERE blocker_id = $1
            OR blocked_id = $2;
            `,
            [
                userId,
                blockedUserId
            ]
        );


        await pool.query(
            `
            DELETE FROM users
            WHERE id IN ($1,$2);
            `,
            [
                userId,
                blockedUserId
            ]
        );


    });



    // =====================================
    // POST /block/:id
    // =====================================

    test("should block another user", async () => {


        const response = await request(app)
            .post(`/block/${blockedUserId}`)
            .set(
                "Authorization",
                `Bearer ${token}`
            );


        expect(response.statusCode)
            .toBe(201);


        expect(response.body.message)
            .toBe("User blocked successfully");



        const result = await pool.query(
            `
            SELECT *
            FROM blocked_users
            WHERE blocker_id = $1
            AND blocked_id = $2;
            `,
            [
                userId,
                blockedUserId
            ]
        );


        expect(result.rows.length)
            .toBe(1);


    });




    // =====================================
    // GET /block
    // =====================================

    test("should retrieve blocked users", async () => {


        await pool.query(
            `
            INSERT INTO blocked_users
            (
                blocker_id,
                blocked_id
            )
            VALUES
            ($1,$2);
            `,
            [
                userId,
                blockedUserId
            ]
        );



        const response = await request(app)
            .get("/block")
            .set(
                "Authorization",
                `Bearer ${token}`
            );



        expect(response.statusCode)
            .toBe(200);



        expect(Array.isArray(response.body))
            .toBe(true);



        expect(
            response.body.some(
                user =>
                    user.blocked_id === blockedUserId
            )
        )
        .toBe(true);


    });





    // =====================================
    // GET /block/search/:name
    // =====================================

    test("should search users to block", async () => {


        const response = await request(app)
            .get("/block/search/Blocked")
            .set(
                "Authorization",
                `Bearer ${token}`
            );



        expect(response.statusCode)
            .toBe(200);



        expect(Array.isArray(response.body))
            .toBe(true);



        expect(
            response.body.some(
                user =>
                    user.id === blockedUserId
            )
        )
        .toBe(true);


    });





    // =====================================
    // DELETE /block/:id
    // =====================================

    test("should unblock user", async () => {


        await pool.query(
            `
            INSERT INTO blocked_users
            (
                blocker_id,
                blocked_id
            )
            VALUES
            ($1,$2);
            `,
            [
                userId,
                blockedUserId
            ]
        );



        const response = await request(app)
            .delete(`/block/${blockedUserId}`)
            .set(
                "Authorization",
                `Bearer ${token}`
            );



        expect(response.statusCode)
            .toBe(200);



        expect(response.body.message)
            .toBe("User unblocked successfully");



        const check = await pool.query(
            `
            SELECT *
            FROM blocked_users
            WHERE blocker_id = $1
            AND blocked_id = $2;
            `,
            [
                userId,
                blockedUserId
            ]
        );



        expect(check.rows.length)
            .toBe(0);


    });


});