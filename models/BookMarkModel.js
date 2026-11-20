const pool = require('./db');

// READ BOOKMARKED POSTS BY USER ID
module.exports.readBookMarksByUserId = (data, callback) => {
    const SQLSTATEMENT = `
        SELECT 
            bookmarked_posts.id AS bookmark_id,
            hangout_posts.id AS post_id,
            hangout_posts.title,
            hangout_posts.description,
            hangout_posts.max_participants,
            hangout_posts.current_participants,
            hangout_posts.created_at,
            sp_locations.location_name,
            users.student_name
        FROM bookmarked_posts
        INNER JOIN hangout_posts
            ON bookmarked_posts.post_id = hangout_posts.id
        INNER JOIN sp_locations
            ON hangout_posts.location_id = sp_locations.id
        INNER JOIN users
            ON hangout_posts.user_id = users.id
        WHERE bookmarked_posts.user_id = $1
        ORDER BY bookmarked_posts.bookmarked_at DESC;
    `;

    const VALUES = [data.user_id];

    pool.query(SQLSTATEMENT, VALUES, callback);
};

// CANCEL BOOKMARK
module.exports.cancelBookMark = (data, callback) => {
    const SQLSTATEMENT = `
        DELETE FROM bookmarked_posts
        WHERE post_id = $1
        AND user_id = $2;
    `;

    const VALUES = [data.post_id, data.user_id];

    pool.query(SQLSTATEMENT, VALUES, callback);
};