const pool = require('./db');

module.exports.readMyProfile = (data, callback) => {
  const SQLSTATEMENT = `
        SELECT
            users.id,
            users.student_name,
            users.student_email,
            users.created_at,

            (
                SELECT COUNT(*)
                FROM hangout_posts
                WHERE hangout_posts.user_id = users.id
            ) AS posts_created,

            (
                SELECT COUNT(*)
                FROM hangout_acceptances
                WHERE hangout_acceptances.user_id = users.id
            ) AS hangouts_joined,

            (
                SELECT COUNT(*)
                FROM bookmarked_posts
                WHERE bookmarked_posts.user_id = users.id
            ) AS bookmarks_saved,

            (
                SELECT COUNT(*)
                FROM friend_requests
                WHERE friend_requests.status = 'ACCEPTED'
                AND (
                    friend_requests.sender_id = users.id
                    OR friend_requests.receiver_id = users.id
                )
            ) AS friends_count,

            (
                SELECT COUNT(*)
                FROM hangout_check_ins
                WHERE hangout_check_ins.user_id = users.id
            ) AS check_ins_completed,

            COALESCE(
                (
                    SELECT sp_locations.location_name
                    FROM hangout_posts
                    INNER JOIN sp_locations
                    ON hangout_posts.location_id = sp_locations.id
                    WHERE hangout_posts.user_id = users.id
                    GROUP BY sp_locations.location_name
                    ORDER BY COUNT(*) DESC
                    LIMIT 1
                ),
                'No favourite yet'
            ) AS favourite_location

        FROM users
        WHERE users.id = $1;
    `;

  const VALUES = [data.user_id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};
