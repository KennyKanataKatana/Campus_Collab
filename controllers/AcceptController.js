const model =
    require("../models/AcceptModel.js");

const pool =
    require("../models/db");


//////////////////////////////////////////////////////
// READ NORMAL ACCEPTANCES BY POST
//////////////////////////////////////////////////////

module.exports.readAcceptancesByPostId =
(req, res, next) => {
    const data = {
        id: req.params.post_id
    };

    const callback =
    (error, results, fields) => {
        if (error) {
            console.error(error);

            return res.status(500).json({
                message:
                    "Internal server error"
            });
        }

        return res
            .status(200)
            .json(results.rows);
    };

    model.readAcceptancesByPostId(
        data,
        callback
    );
};


//////////////////////////////////////////////////////
// READ PARTICIPANT NAMES AND CAPACITY
//////////////////////////////////////////////////////

module.exports.readParticipantsByPostId =
(req, res, next) => {
    const data = {
        id: req.params.post_id
    };

    const callback =
    (error, results, fields) => {
        if (error) {
            console.error(error);

            return res.status(500).json({
                message:
                    "Internal server error"
            });
        }

        if (results.rows.length === 0) {
            return res.status(404).json({
                error: "Post not found"
            });
        }

        return res
            .status(200)
            .json(results.rows[0]);
    };

    model.readParticipantsByPostId(
        data,
        callback
    );
};


//////////////////////////////////////////////////////
// ACCEPT POST
//////////////////////////////////////////////////////

module.exports.acceptPost =
(req, res, next) => {
    const data = {
        post_id:
            req.params.post_id,

        user_id:
            res.locals.userId
    };

    const callback =
    (error, result) => {
        if (error) {
            if (error.code === "23503") {
                return res
                    .status(404)
                    .json({
                        message:
                            "User or post does not exist"
                    });
            }

            if (error.code === "23505") {
                return res
                    .status(409)
                    .json({
                        message:
                            "You have already joined a hangout."
                    });
            }

            console.error(error);

            return res
                .status(500)
                .json({
                    message:
                        "Internal server error"
                });
        }

        if (
            result.status ===
            "POST_NOT_FOUND"
        ) {
            return res
                .status(404)
                .json({
                    error:
                        "Post not found"
                });
        }

        if (
            result.status ===
            "HOST"
        ) {
            return res
                .status(409)
                .json({
                    message:
                        "You created this hangout and are already counted as the host.",

                    current_participants:
                        result.current_participants,

                    max_participants:
                        result.max_participants
                });
        }

        if (
            result.status ===
            "ALREADY_ACCEPTED"
        ) {
            return res
                .status(409)
                .json({
                    message:
                        "You have already joined this hangout.",

                    current_participants:
                        result.current_participants,

                    max_participants:
                        result.max_participants
                });
        }

        if (
            result.status ===
            "ALREADY_ACCEPTED_OTHER"
        ) {
            return res
                .status(409)
                .json({
                    message:
                        "You already joined another hangout. Unaccept it before joining this one.",

                    existing_post_id:
                        result.existing_post_id
                });
        }

        if (
            result.status ===
            "FULL"
        ) {
            return res
                .status(409)
                .json({
                    message:
                        "Sorry, this hangout is already full.",

                    isFull: true,

                    current_participants:
                        result.current_participants,

                    max_participants:
                        result.max_participants
                });
        }

        return res
            .status(201)
            .json({
                message:
                    "Hangout joined successfully",

                acceptance:
                    result.acceptance,

                current_participants:
                    result.current_participants,

                max_participants:
                    result.max_participants
            });
    };

    model.acceptPost(
        data,
        callback
    );
};


//////////////////////////////////////////////////////
// UNACCEPT POST
//////////////////////////////////////////////////////

module.exports.cancelAccept =
(req, res, next) => {
    const data = {
        user_id:
            res.locals.userId,

        post_id:
            req.params.post_id
    };

    const callback =
    (error, result) => {
        if (error) {
            console.error(error);

            return res
                .status(500)
                .json({
                    message:
                        "Internal server error"
                });
        }

        if (
            result.status ===
            "POST_NOT_FOUND"
        ) {
            return res
                .status(404)
                .json({
                    error:
                        "Post not found"
                });
        }

        if (
            result.status ===
            "ACCEPTANCE_NOT_FOUND"
        ) {
            return res
                .status(404)
                .json({
                    error:
                        "Acceptance not found"
                });
        }

        return res
            .status(200)
            .json({
                message:
                    "You left the hangout successfully",

                deletedPost:
                    result.deleted_acceptance,

                current_participants:
                    result.current_participants,

                max_participants:
                    result.max_participants
            });
    };

    model.deleteAccept(
        data,
        callback
    );
};


//////////////////////////////////////////////////////
// READ ALL ACCEPTANCES
//////////////////////////////////////////////////////

module.exports.getAllAcceptances = (req, res) => {
    return pool.query(
        `
        SELECT *
        FROM hangout_acceptances
        ORDER BY id DESC
        `
    )
    .then((result) => {
        return res
            .status(200)
            .json(result.rows);
    })
    .catch((error) => {
        console.error(error);

        return res
            .status(500)
            .json({
                message:
                    "Internal server error"
            });
    });
};


//////////////////////////////////////////////////////
// READ USER ACCEPTED POST
//////////////////////////////////////////////////////

module.exports.getAllAcceptancesByUserId =
(req, res, next) => {
    const data = {
        id: req.params.user_id
    };

    const callback =
    (error, results, fields) => {
        if (error) {
            console.error(error);

            return res
                .status(500)
                .json({
                    message:
                        "Internal server error"
                });
        }

        return res
            .status(200)
            .json(results.rows);
    };

    model.readAcceptancesByUserId(
        data,
        callback
    );
};