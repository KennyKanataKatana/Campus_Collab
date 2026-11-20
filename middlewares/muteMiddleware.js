const pool = require("../models/db");

module.exports.checkIfMuted = (req, res, next) => {
    const userId = res.locals.userId;

    if (!userId) {
        return res.status(401).json({
            error: "Invalid or missing user in token"
        });
    }

    const SQLSTATMENT = `
        SELECT id, is_muted, muted_at, mute_until, muted_reason
        FROM users
        WHERE id = $1;
    `;

    pool.query(SQLSTATMENT, [userId], (error, results) => {
        if (error) {
            console.error("Error checkIfMuted:", error);
            return res.status(500).json({
                error: "Internal server error"
            });
        }

        if (!results || results.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        const user = results.rows[0];

        if (user.is_muted === true) {
            return res.status(403).json({
                error: "You are muted and cannot perform this action right now",
                muted_reason: user.muted_reason || "Muted by admin"
            });
        }

        return next();
    });
};