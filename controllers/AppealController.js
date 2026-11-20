const model = require("../models/AppealModel.js");

module.exports.createAppeal = (req, res, next) => {
    if (res.locals.userId == undefined) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    if (req.body.reason == undefined || req.body.reason.trim() === "") {
        return res.status(400).json({
            message: "reason is missing"
        });
    }

    const data = {
        user_id: res.locals.userId,
        report_id: req.body.report_id || null,
        reason: req.body.reason
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error createAppeal:", error);

            if (error.code == 23503) {
                return res.status(404).json({
                    message: "Related report not found"
                });
            }

            return res.status(500).json({
                message: "Internal server error"
            });
        }

        return res.status(201).json({
            message: "Appeal submitted successfully",
            appeal: results.rows[0]
        });
    };

    model.createAppeal(data, callback);
};

module.exports.readAllAppeals = (req, res, next) => {
    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error readAllAppeals:", error);
            return res.status(500).json({
                message: "Internal server error"
            });
        }

        return res.status(200).json(results.rows);
    };

    model.readAllAppeals(callback);
};