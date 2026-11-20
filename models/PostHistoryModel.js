const pool = require("./db");


// READ HISTORY BY USER
module.exports.readPostHistoryByUser = (data, callback) => {

    const SQLSTATEMENT = `
        SELECT
            ph.*,
            sl.location_name
        FROM post_history ph
        JOIN sp_locations sl
            ON ph.location_id = sl.id
        WHERE ph.user_id = $1
        ORDER BY ph.archived_at DESC;
    `;


    const VALUES = [
        data.user_id
    ];

    pool.query(SQLSTATEMENT, VALUES, callback);

};

// DELETE HISTORY
module.exports.deletePostHistory = (data, callback) => {

    const SQLSTATEMENT = `
        DELETE FROM post_history
        WHERE id = $1
        RETURNING *;
    `;


    const VALUES = [
        data.history_id
    ];


    pool.query(SQLSTATEMENT, VALUES, callback);

};