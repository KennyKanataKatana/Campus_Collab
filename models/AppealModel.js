const pool = require("./db");

module.exports.createAppeal = (data, callback) => {
    const SQLSTATMENT = `
        INSERT INTO appeals (user_id, report_id, reason)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;

    const VALUES = [data.user_id, data.report_id || null, data.reason];
    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.readAppealsByUserId = (data, callback) => {
    const SQLSTATMENT = `
        SELECT appeals.*, users.student_name
        FROM appeals
        INNER JOIN users ON appeals.user_id = users.id
        WHERE appeals.user_id = $1
        ORDER BY appeals.created_at DESC;
    `;

    const VALUES = [data.user_id];
    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.readAllAppeals = (callback) => {
    const SQLSTATMENT = `
        SELECT appeals.*, users.student_name
        FROM appeals
        INNER JOIN users ON appeals.user_id = users.id
        ORDER BY appeals.created_at DESC;
    `;

    pool.query(SQLSTATMENT, callback);
};