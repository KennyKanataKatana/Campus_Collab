const request = require("supertest");
const app = require("../../src/app");
const pool = require("../../src/models/db");
const jwt = require("jsonwebtoken");


describe("Bookmark Feature Integration Test", () => {

    let userId;
    let postId;
    let token;


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
                'Bookmark Tester',
                'bookmarktester@ichat.sp.edu.sg',
                'hashedpassword'
            )
            RETURNING id;
            `
        );


        userId = user.rows[0].id;



        // Create bookmark post owner
        const location = await pool.query(
            `
            INSERT INTO sp_locations
            (
                location_name
            )
            VALUES
            (
                'Bookmark Test Location'
            )
            ON CONFLICT(location_name)
            DO UPDATE SET location_name = EXCLUDED.location_name
            RETURNING id;
            `
        );


        const post = await pool.query(
            `
            INSERT INTO hangout_posts
            (
                user_id,
                title,
                description,
                location_id,
                max_participants
            )
            VALUES
            (
                $1,
                'Bookmark Test Post',
                'Testing bookmark retrieval',
                $2,
                5
            )
            RETURNING id;
            `,
            [
                userId,
                location.rows[0].id
            ]
        );


        postId = post.rows[0].id;



        // Create bookmark directly
        await pool.query(
            `
            INSERT INTO bookmarked_posts
            (
                user_id,
                post_id
            )
            VALUES
            (
                $1,
                $2
            );
            `,
            [
                userId,
                postId
            ]
        );



        token = jwt.sign(
            {
                userId
            },
            process.env.JWT_SECRET_KEY,
            {
                expiresIn:"1h"
            }
        );


    });



    afterAll(async()=>{


        await pool.query(
            `
            DELETE FROM bookmarked_posts
            WHERE user_id=$1;
            `,
            [
                userId
            ]
        );


        await pool.query(
            `
            DELETE FROM hangout_posts
            WHERE id=$1;
            `,
            [
                postId
            ]
        );


        await pool.query(
            `
            DELETE FROM users
            WHERE id=$1;
            `,
            [
                userId
            ]
        );


        await pool.end();

    });





    // ==========================================
    // GET BOOKMARKS
    // ==========================================


    test("should retrieve bookmarked posts", async()=>{


        const response = await request(app)
            .get("/bookmark")
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
                post =>
                    post.post_id === postId
            )
        )
        .toBe(true);



    });






    // ==========================================
    // DELETE BOOKMARK
    // ==========================================


    test("should remove bookmark", async()=>{


        const response = await request(app)
            .delete(`/bookmark/${postId}`)
            .set(
                "Authorization",
                `Bearer ${token}`
            );



        expect(response.statusCode)
            .toBe(200);



        expect(response.body.message)
            .toBe(
                "Bookmark deleted successfully"
            );



        const check = await pool.query(
            `
            SELECT *
            FROM bookmarked_posts
            WHERE user_id=$1
            AND post_id=$2;
            `,
            [
                userId,
                postId
            ]
        );



        expect(check.rows.length)
            .toBe(0);



    });






    // ==========================================
    // DELETE NON EXISTING BOOKMARK
    // ==========================================


    test("should return 404 when bookmark does not exist", async()=>{


        const response = await request(app)
            .delete("/bookmark/99999")
            .set(
                "Authorization",
                `Bearer ${token}`
            );


        expect(response.statusCode)
            .toBe(404);


        expect(response.body.message)
            .toBe(
                "Bookmark not found"
            );


    });


});