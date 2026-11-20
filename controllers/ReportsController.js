const model = require("../models/ReportsModel.js");

module.exports.createReport = (req, res, next) => {
    if (res.locals.userId == undefined) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    if (
        req.body.reported_student_name == undefined ||
        req.body.incident_area == undefined ||
        req.body.reason == undefined
    ) {
        return res.status(400).json({
            message: "reported_student_name, incident_area or reason is missing"
        });
    }

    const data = {
        reporter_id: res.locals.userId,
        reported_student_name: req.body.reported_student_name,
        incident_area: req.body.incident_area,
        reason: req.body.reason,
        proof_image_url: req.body.proof_image_url
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error createReport:", error);

            if (error.code == 23514) {
                return res.status(400).json({
                    message: "You cannot report yourself"
                });
            }

            if (error.code == 23503) {
                return res.status(404).json({
                    message: "Reported user not found"
                });
            }

            return res.status(500).json({
                message: "Internal server error"
            });
        }

        if (results.rows.length == 0) {
            return res.status(404).json({
                message: "Reported user not found"
            });
        }

        return res.status(201).json({
            message: "User reported successfully",
            report: results.rows[0]
        });
    };

    model.createReport(data, callback);
};

module.exports.readAllReports = (req, res, next) => {
    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error readAllReports:", error);
            return res.status(500).json({
                message: "Internal server error"
            });
        }

        return res.status(200).json(results.rows);
    };

    model.readAllReports(callback);
};

module.exports.readReportsByReporterId = (req, res, next) => {
    const data = {
        reporter_id: req.params.reporter_id
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error readReportsByReporterId:", error);
            return res.status(500).json({
                message: "Internal server error"
            });
        }

        if (results.rows.length == 0) {
            return res.status(404).json({
                message: "No reports found for this reporter"
            });
        }

        return res.status(200).json(results.rows);
    };

    model.readReportsByReporterId(data, callback);
};

module.exports.readReportsByReportedUserId = (req, res, next) => {
    const data = {
        reported_user_id: req.params.reported_user_id
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error readReportsByReportedUserId:", error);
            return res.status(500).json({
                message: "Internal server error"
            });
        }

        if (results.rows.length == 0) {
            return res.status(404).json({
                message: "No reports found for this reported user"
            });
        }

        return res.status(200).json(results.rows);
    };

    model.readReportsByReportedUserId(data, callback);
};

module.exports.readReportableUsers = (req, res, next) => {
    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error readReportableUsers:", error);
            return res.status(500).json({
                message: "Internal server error"
            });
        }

        return res.status(200).json(results.rows);
    };

    model.readReportableUsers(callback);
};

module.exports.muteReportedUser = (req, res, next) => {
    const data = {
        reported_user_id: req.params.reported_user_id
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error muteReportedUser:", error);
            return res.status(500).json({
                message: "Internal server error"
            });
        }

        if (results.rows.length == 0) {
            return res.status(404).json({
                message: "Reported user not found"
            });
        }

        return res.status(200).json({
            message: "User muted successfully",
            user: results.rows[0]
        });
    };

    model.muteReportedUser(data, callback);
};

module.exports.readMutedUsers = (req, res, next) => {
    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error readMutedUsers:", error);
            return res.status(500).json({
                message: "Internal server error"
            });
        }

        return res.status(200).json(results.rows);
    };

    model.readMutedUsers(callback);
};

module.exports.unmuteUser = (req, res, next) => {
    const data = {
        user_id: req.params.user_id
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error unmuteUser:", error);
            return res.status(500).json({
                message: "Internal server error"
            });
        }

        if (results.rows.length == 0) {
            return res.status(404).json({
                message: "Muted user not found"
            });
        }

        return res.status(200).json({
            message: "User unmuted successfully",
            user: results.rows[0]
        });
    };

    model.unmuteUser(data, callback);
};

module.exports.readMyReceivedReports = (req, res, next) => {
    if (res.locals.userId == undefined) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    const data = {
        reported_user_id: res.locals.userId
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error readMyReceivedReports:", error);
            return res.status(500).json({
                message: "Internal server error"
            });
        }

        return res.status(200).json(results.rows);
    };

    model.readReportsByReportedUserId(data, callback);
};