const pool = require('./db')

module.exports.readAllPosts = (callback) => {
    const SQLSTATMENT = `
        SELECT
            hp.*,
            users.student_name
        FROM hangout_posts AS hp
        INNER JOIN users
            ON hp.user_id = users.id
        ORDER BY hp.created_at DESC;
    `;

    pool.query(SQLSTATMENT, callback);
};

module.exports.uploadPost = (data, callback) => {
    const SQLSTATMENT =`INSERT INTO hangout_posts (user_id, title, description, location_id, max_participants, hangout_at)
    VALUES ($1, $2, $3, $4, $5, $6)

    RETURNING *;`;

    const VALUES = [data.user_id, data.title, data.description, data.location_id, data.max_participants, data.hangout_at];

    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.createPostHistory = (data, callback) => {

    const SQLSTATEMENT = `
        INSERT INTO post_history
        (
            original_post_id,
            user_id,
            title,
            description,
            location_id,
            max_participants,
            created_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7);
    `;

    const VALUES = [
        data.original_post_id,
        data.user_id,
        data.title,
        data.description,
        data.location_id,
        data.max_participants,
        data.created_at
    ];

    pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getPostById = (post_id, callback) => {
    const SQLSTATMENT = `
        SELECT *
        FROM hangout_posts
        WHERE id = $1;
    `;

    const VALUES = [post_id];
    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.deletePost = (data, callback) => {
    const SQLSTATMENT = `
        WITH target_post AS (
            SELECT id, user_id, title FROM hangout_posts
            WHERE id = $1 AND user_id = $2
        ), recipients AS (
            SELECT DISTINCT invitation.receiver_id AS user_id
            FROM hangout_invitations AS invitation
            JOIN target_post ON target_post.id = invitation.post_id
            WHERE invitation.status IN ('PENDING', 'ACCEPTED')
            UNION
            SELECT DISTINCT acceptance.user_id
            FROM hangout_acceptances AS acceptance
            JOIN target_post ON target_post.id = acceptance.post_id
        ), notified AS (
            INSERT INTO notifications
                (user_id, actor_id, post_id, type, dedupe_key, message)
            SELECT recipients.user_id, target_post.user_id, target_post.id,
                'HANGOUT_CANCELLED',
                'hangout:' || target_post.id || ':cancelled:' || recipients.user_id,
                'The hangout "' || target_post.title || '" was cancelled.'
            FROM recipients CROSS JOIN target_post
            ON CONFLICT (dedupe_key) DO NOTHING
        )
        DELETE FROM hangout_posts
        WHERE id IN (SELECT id FROM target_post)
        RETURNING *;
    `;

    const VALUES = [data.post_id, data.user_id];
    pool.query(SQLSTATMENT, VALUES, callback);
};

// BOOKMARK POST
module.exports.bookMarkPost = (data, callback) => {
    const SQLSTATMENT = `
    INSERT INTO bookmarked_posts (post_id, user_id)
    VALUES ($1, $2)
    RETURNING *;
    `;

    const VALUES = [data.post_id, data.user_id];

    pool.query(SQLSTATMENT, VALUES, callback);
};