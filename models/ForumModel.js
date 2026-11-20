const pool = require('./db');

const SORT_COLUMN_MAP = {
    recent: "forum_threads.created_at DESC",
    likes: "like_count DESC, forum_threads.created_at DESC",
    dislikes: "dislike_count DESC, forum_threads.created_at DESC"
};

module.exports.readAllThreads = (userId, sortBy, callback) => {
    const orderByClause = SORT_COLUMN_MAP[sortBy] || SORT_COLUMN_MAP.recent;

    const SQLSTATMENT = `
        SELECT
            forum_threads.id,
            forum_threads.user_id,
            users.student_name,
            forum_threads.location_id,
            sp_locations.location_name,
            forum_threads.title,
            forum_threads.content,
            forum_threads.image_url,
            forum_threads.video_url,
            forum_threads.created_at,
            forum_threads.updated_at,
            (SELECT COUNT(*) FROM forum_thread_votes
                WHERE thread_id = forum_threads.id AND vote_type = 'LIKE') AS like_count,
            (SELECT COUNT(*) FROM forum_thread_votes
                WHERE thread_id = forum_threads.id AND vote_type = 'DISLIKE') AS dislike_count,
            (SELECT vote_type FROM forum_thread_votes
                WHERE thread_id = forum_threads.id AND user_id = $1) AS my_vote
        FROM forum_threads
        INNER JOIN users ON forum_threads.user_id = users.id
        INNER JOIN sp_locations ON forum_threads.location_id = sp_locations.id
        ORDER BY ${orderByClause};
    `;

    const VALUES = [userId];
    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.readThreadById = (data, callback) => {
    const SQLSTATMENT = `
        SELECT
            forum_threads.id,
            forum_threads.user_id,
            users.student_name,
            forum_threads.location_id,
            sp_locations.location_name,
            forum_threads.title,
            forum_threads.content,
            forum_threads.image_url,
            forum_threads.video_url,
            forum_threads.created_at,
            forum_threads.updated_at,
            (SELECT COUNT(*) FROM forum_thread_votes
                WHERE thread_id = forum_threads.id AND vote_type = 'LIKE') AS like_count,
            (SELECT COUNT(*) FROM forum_thread_votes
                WHERE thread_id = forum_threads.id AND vote_type = 'DISLIKE') AS dislike_count,
            (SELECT vote_type FROM forum_thread_votes
                WHERE thread_id = forum_threads.id AND user_id = $2) AS my_vote
        FROM forum_threads
        INNER JOIN users ON forum_threads.user_id = users.id
        INNER JOIN sp_locations ON forum_threads.location_id = sp_locations.id
        WHERE forum_threads.id = $1;
    `;

    const VALUES = [data.thread_id, data.user_id || null];
    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.createThread = (data, callback) => {
    const SQLSTATMENT = `
        INSERT INTO forum_threads (user_id, location_id, title, content, image_url, video_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
    `;

    const VALUES = [
        data.user_id,
        data.location_id,
        data.title,
        data.content,
        data.image_url || null,
        data.video_url || null
    ];
    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.readRepliesByThreadId = (data, callback) => {
    const SQLSTATMENT = `
        SELECT
            forum_replies.id,
            forum_replies.thread_id,
            forum_replies.user_id,
            users.student_name,
            forum_replies.content,
            forum_replies.created_at
        FROM forum_replies
        INNER JOIN users ON forum_replies.user_id = users.id
        WHERE forum_replies.thread_id = $1
        ORDER BY forum_replies.created_at ASC;
    `;

    const VALUES = [data.thread_id];
    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.createReply = (data, callback) => {
    const SQLSTATMENT = `
        INSERT INTO forum_replies (thread_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;

    const VALUES = [data.thread_id, data.user_id, data.content];
    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.deleteThread = (data, callback) => {
    const SQLSTATMENT = `
        DELETE FROM forum_threads
        WHERE id = $1 AND user_id = $2
        RETURNING *;
    `;

    const VALUES = [data.thread_id, data.user_id];
    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.castVote = (data, callback) => {
    const SQLSTATMENT = `
        INSERT INTO forum_thread_votes (thread_id, user_id, vote_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (thread_id, user_id)
        DO UPDATE SET vote_type = EXCLUDED.vote_type, created_at = CURRENT_TIMESTAMP
        RETURNING *;
    `;

    const VALUES = [data.thread_id, data.user_id, data.vote_type];
    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.removeVote = (data, callback) => {
    const SQLSTATMENT = `
        DELETE FROM forum_thread_votes
        WHERE thread_id = $1 AND user_id = $2
        RETURNING *;
    `;

    const VALUES = [data.thread_id, data.user_id];
    pool.query(SQLSTATMENT, VALUES, callback);
};