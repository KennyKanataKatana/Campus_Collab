const pool = require('./db');

module.exports.readBlocksByUserId = (data, callback) => {

    const SQLSTATEMENT = `
        SELECT
            blocked_users.blocked_id,
            users.student_name
        FROM blocked_users

        INNER JOIN users
            ON blocked_users.blocked_id = users.id

        WHERE blocked_users.blocker_id = $1

        ORDER BY users.student_name DESC;
    `;

    const VALUES = [data.user_id];

    pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.blockUser = (data, callback) => {

    const SQLSTATEMENT = `
        INSERT INTO blocked_users (blocker_id, blocked_id)
        VALUES ($1, $2);
    `;

    const VALUES = [
        data.blocker_id,
        data.blocked_id
    ];

    pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.unblockUser = (data, callback) => {

    const SQLSTATEMENT = `
        DELETE FROM blocked_users
        WHERE blocker_id = $1
        AND blocked_id = $2;
    `;

    const VALUES = [
        data.blocker_id,
        data.blocked_id
    ];

    pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.searchUsersToBlock = (data, callback) => {

    const SQL_QUERY = `
        SELECT 
            id,
            student_name,
            student_email
        FROM users
        WHERE student_name ILIKE $1
        AND id != $2

        -- exclude already blocked users
        AND id NOT IN (
            SELECT blocked_id
            FROM blocked_users
            WHERE blocker_id = $2
        )

        LIMIT 10;
    `;

    const VALUES = [
        `%${data.search}%`,
        data.user_id
    ];

    pool.query(SQL_QUERY, VALUES, callback);
};