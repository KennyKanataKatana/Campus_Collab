const pool = require("./db");

module.exports.createReport = (data, callback) => {
    const SQLSTATMENT = `
        INSERT INTO reports (reporter_id, reported_user_id, incident_area, reason, proof_image_url)
        SELECT $1, users.id, $3, $4, $5
        FROM users
        WHERE LOWER(users.student_name) = LOWER($2)
        RETURNING *;
    `;

    const VALUES = [
        data.reporter_id,
        data.reported_student_name,
        data.incident_area,
        data.reason,
        data.proof_image_url || null
    ];

    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.readAllReports = (callback) => {
    const SQLSTATMENT = `
        SELECT reports.*, 
               reporter.student_name AS reporter_name,
               reported.student_name AS reported_user_name
        FROM reports
        JOIN users AS reporter
            ON reports.reporter_id = reporter.id
        JOIN users AS reported
            ON reports.reported_user_id = reported.id
        ORDER BY reports.created_at DESC;
    `;

    pool.query(SQLSTATMENT, callback);
};

module.exports.readReportsByReporterId = (data, callback) => {
    const SQLSTATMENT = `
        SELECT reports.*, 
               reporter.student_name AS reporter_name,
               reported.student_name AS reported_user_name
        FROM reports
        JOIN users AS reporter
            ON reports.reporter_id = reporter.id
        JOIN users AS reported
            ON reports.reported_user_id = reported.id
        WHERE reports.reporter_id = $1
        ORDER BY reports.created_at DESC;
    `;

    const VALUES = [data.reporter_id];

    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.readReportsByReportedUserId = (data, callback) => {
    const SQLSTATMENT = `
        SELECT reports.*, 
               reporter.student_name AS reporter_name,
               reported.student_name AS reported_user_name
        FROM reports
        JOIN users AS reporter
            ON reports.reporter_id = reporter.id
        JOIN users AS reported
            ON reports.reported_user_id = reported.id
        WHERE reports.reported_user_id = $1
        ORDER BY reports.created_at DESC;
    `;

    const VALUES = [data.reported_user_id];

    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.readReportableUsers = (callback) => {
    const SQLSTATMENT = `
        SELECT id, student_name
        FROM users
        ORDER BY student_name ASC;
    `;

    pool.query(SQLSTATMENT, callback);
};

module.exports.muteReportedUser = (data, callback) => {
    const SQLSTATMENT = `
        UPDATE users
        SET is_muted = TRUE,
            muted_at = CURRENT_TIMESTAMP,
            mute_until = NULL,
            muted_reason = 'Muted by admin'
        WHERE id = $1
        RETURNING id, student_name, is_muted, muted_at, mute_until, muted_reason;
    `;

    const VALUES = [data.reported_user_id];

    pool.query(SQLSTATMENT, VALUES, callback);
};

module.exports.readMutedUsers = (callback) => {
    const SQLSTATMENT = `
        SELECT id, student_name, is_muted, muted_at, mute_until, muted_reason
        FROM users
        WHERE is_muted = TRUE
        ORDER BY muted_at DESC;
    `;

    pool.query(SQLSTATMENT, callback);
};

module.exports.unmuteUser = (data, callback) => {
    const SQLSTATMENT = `
        UPDATE users
        SET is_muted = FALSE,
            muted_at = NULL,
            mute_until = NULL,
            muted_reason = NULL
        WHERE id = $1
        RETURNING id, student_name, is_muted, muted_at, mute_until, muted_reason;
    `;

    const VALUES = [data.user_id];

    pool.query(SQLSTATMENT, VALUES, callback);
};