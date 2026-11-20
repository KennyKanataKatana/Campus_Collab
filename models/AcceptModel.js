const pool =
    require("./db");


//////////////////////////////////////////////////////
// READ ACCEPTANCE RECORDS BY POST
//////////////////////////////////////////////////////

module.exports.readAcceptancesByPostId =
(data, callback) => {
    const SQLSTATMENT = `
        SELECT *
        FROM hangout_acceptances
        WHERE post_id = $1
        ORDER BY accepted_at ASC;
    `;

    const VALUES = [
        data.id
    ];

    pool.query(
        SQLSTATMENT,
        VALUES,
        callback
    );
};


//////////////////////////////////////////////////////
// READ PARTICIPANTS INCLUDING HOST
//////////////////////////////////////////////////////

module.exports.readParticipantsByPostId =
(data, callback) => {
    const SQLSTATMENT = `
        WITH participant_rows AS (
            SELECT
                hp.id AS post_id,
                hp.user_id,
                u.student_name,
                TRUE AS is_host,
                hp.created_at AS joined_at
            FROM hangout_posts hp

            JOIN users u
            ON u.id = hp.user_id

            WHERE hp.id = $1

            UNION ALL

            SELECT
                ha.post_id,
                ha.user_id,
                u.student_name,
                FALSE AS is_host,
                ha.accepted_at AS joined_at
            FROM hangout_acceptances ha

            JOIN users u
            ON u.id = ha.user_id

            WHERE ha.post_id = $1
        )

        SELECT
            hp.id AS post_id,

            hp.current_participants,

            hp.max_participants,

            hp.current_participants >=
            hp.max_participants
            AS is_full,

            COALESCE(
                json_agg(
                    json_build_object(
                        'user_id',
                        participant_rows.user_id,

                        'student_name',
                        participant_rows.student_name,

                        'is_host',
                        participant_rows.is_host,

                        'joined_at',
                        participant_rows.joined_at
                    )

                    ORDER BY
                        participant_rows.is_host DESC,
                        participant_rows.joined_at ASC
                )

                FILTER (
                    WHERE
                    participant_rows.user_id
                    IS NOT NULL
                ),

                '[]'::json
            ) AS participants

        FROM hangout_posts hp

        LEFT JOIN participant_rows
        ON participant_rows.post_id = hp.id

        WHERE hp.id = $1

        GROUP BY
            hp.id,
            hp.current_participants,
            hp.max_participants;
    `;

    const VALUES = [
        data.id
    ];

    pool.query(
        SQLSTATMENT,
        VALUES,
        callback
    );
};


//////////////////////////////////////////////////////
// FIND POST
//////////////////////////////////////////////////////

module.exports.findPost =
(data, callback) => {
    const SQLSTATMENT = `
        SELECT *
        FROM hangout_posts
        WHERE id = $1;
    `;

    const VALUES = [
        data.post_id
    ];

    pool.query(
        SQLSTATMENT,
        VALUES,
        callback
    );
};


//////////////////////////////////////////////////////
// ACCEPT POST WITH TRANSACTION
//////////////////////////////////////////////////////

module.exports.acceptPost =
async (data, callback) => {
    let client;

    try {
        client =
            await pool.connect();

        await client.query(
            "BEGIN"
        );

        //////////////////////////////////////////////////
        // LOCK POST
        //////////////////////////////////////////////////

        const postResult =
            await client.query(
                `
                SELECT
                    id,
                    user_id,
                    current_participants,
                    max_participants

                FROM hangout_posts

                WHERE id = $1

                FOR UPDATE;
                `,
                [
                    data.post_id
                ]
            );

        if (
            postResult.rows.length === 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            callback(
                null,
                {
                    status:
                        "POST_NOT_FOUND"
                }
            );

            return;
        }

        const post =
            postResult.rows[0];

        //////////////////////////////////////////////////
        // HOST CANNOT ACCEPT OWN POST
        //////////////////////////////////////////////////

        if (
            String(post.user_id) ===
            String(data.user_id)
        ) {
            await client.query(
                "ROLLBACK"
            );

            callback(
                null,
                {
                    status: "HOST",

                    current_participants:
                        post.current_participants,

                    max_participants:
                        post.max_participants
                }
            );

            return;
        }

        //////////////////////////////////////////////////
        // CHECK EXISTING ACCEPTANCE
        //////////////////////////////////////////////////

        const existingAcceptance =
            await client.query(
                `
                SELECT post_id

                FROM hangout_acceptances

                WHERE user_id = $1

                FOR UPDATE;
                `,
                [
                    data.user_id
                ]
            );

        if (
            existingAcceptance
                .rows.length > 0
        ) {
            const existingPostId =
                existingAcceptance
                    .rows[0]
                    .post_id;

            await client.query(
                "ROLLBACK"
            );

            callback(
                null,
                {
                    status:
                        String(
                            existingPostId
                        ) ===
                        String(
                            data.post_id
                        )
                            ? "ALREADY_ACCEPTED"
                            : "ALREADY_ACCEPTED_OTHER",

                    existing_post_id:
                        existingPostId,

                    current_participants:
                        post.current_participants,

                    max_participants:
                        post.max_participants
                }
            );

            return;
        }

        //////////////////////////////////////////////////
        // CHECK CAPACITY
        //////////////////////////////////////////////////

        if (
            post.current_participants >=
            post.max_participants
        ) {
            await client.query(
                "ROLLBACK"
            );

            callback(
                null,
                {
                    status: "FULL",

                    current_participants:
                        post.current_participants,

                    max_participants:
                        post.max_participants
                }
            );

            return;
        }

        //////////////////////////////////////////////////
        // INSERT ACCEPTANCE
        //////////////////////////////////////////////////

        const acceptanceResult =
            await client.query(
                `
                INSERT INTO
                hangout_acceptances
                (
                    post_id,
                    user_id,
                    accepted_at
                )

                VALUES
                (
                    $1,
                    $2,
                    CURRENT_TIMESTAMP
                )

                RETURNING *;
                `,
                [
                    data.post_id,
                    data.user_id
                ]
            );

        //////////////////////////////////////////////////
        // INCREASE PARTICIPANT COUNT
        //////////////////////////////////////////////////

        const updatedPostResult =
            await client.query(
                `
                UPDATE hangout_posts

                SET current_participants =
                    current_participants + 1

                WHERE id = $1

                RETURNING
                    current_participants,
                    max_participants;
                `,
                [
                    data.post_id
                ]
            );

        await client.query(
            "COMMIT"
        );

        callback(
            null,
            {
                status:
                    "ACCEPTED",

                acceptance:
                    acceptanceResult
                        .rows[0],

                current_participants:
                    updatedPostResult
                        .rows[0]
                        .current_participants,

                max_participants:
                    updatedPostResult
                        .rows[0]
                        .max_participants
            }
        );
    } catch (error) {
        if (client) {
            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (rollbackError) {
                console.error(
                    "Rollback error:",
                    rollbackError
                );
            }
        }

        callback(error);
    } finally {
        if (client) {
            client.release();
        }
    }
};


//////////////////////////////////////////////////////
// READ ACCEPTANCE BY USER
//////////////////////////////////////////////////////

module.exports.readAcceptancesByUserId =
(data, callback) => {
    const SQLSTATMENT = `
        SELECT
            ha.*,

            hp.title
            AS post_title,

            hp.current_participants,

            hp.max_participants

        FROM hangout_acceptances ha

        JOIN hangout_posts hp
        ON hp.id = ha.post_id

        WHERE ha.user_id = $1;
    `;

    const VALUES = [
        data.id
    ];

    pool.query(
        SQLSTATMENT,
        VALUES,
        callback
    );
};


//////////////////////////////////////////////////////
// DELETE ACCEPTANCE WITH TRANSACTION
//////////////////////////////////////////////////////

module.exports.deleteAccept =
async (data, callback) => {
    let client;

    try {
        client =
            await pool.connect();

        await client.query(
            "BEGIN"
        );

        //////////////////////////////////////////////////
        // LOCK POST
        //////////////////////////////////////////////////

        const postResult =
            await client.query(
                `
                SELECT
                    id,
                    current_participants,
                    max_participants

                FROM hangout_posts

                WHERE id = $1

                FOR UPDATE;
                `,
                [
                    data.post_id
                ]
            );

        if (
            postResult.rows.length === 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            callback(
                null,
                {
                    status:
                        "POST_NOT_FOUND"
                }
            );

            return;
        }

        //////////////////////////////////////////////////
        // DELETE ACCEPTANCE
        //////////////////////////////////////////////////

        const deletedResult =
            await client.query(
                `
                DELETE FROM
                hangout_acceptances

                WHERE
                    user_id = $1

                AND
                    post_id = $2

                RETURNING *;
                `,
                [
                    data.user_id,
                    data.post_id
                ]
            );

        if (
            deletedResult.rows.length === 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            callback(
                null,
                {
                    status:
                        "ACCEPTANCE_NOT_FOUND"
                }
            );

            return;
        }

        //////////////////////////////////////////////////
        // REDUCE PARTICIPANT COUNT
        //////////////////////////////////////////////////

        const updatedPostResult =
            await client.query(
                `
                UPDATE hangout_posts

                SET current_participants =
                    GREATEST(
                        current_participants - 1,
                        1
                    )

                WHERE id = $1

                RETURNING
                    current_participants,
                    max_participants;
                `,
                [
                    data.post_id
                ]
            );

        await client.query(
            "COMMIT"
        );

        callback(
            null,
            {
                status:
                    "CANCELLED",

                deleted_acceptance:
                    deletedResult
                        .rows[0],

                current_participants:
                    updatedPostResult
                        .rows[0]
                        .current_participants,

                max_participants:
                    updatedPostResult
                        .rows[0]
                        .max_participants
            }
        );
    } catch (error) {
        if (client) {
            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (rollbackError) {
                console.error(
                    "Rollback error:",
                    rollbackError
                );
            }
        }

        callback(error);
    } finally {
        if (client) {
            client.release();
        }
    }
};