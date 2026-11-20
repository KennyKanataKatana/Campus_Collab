const model = require("../models/ForumModel.js");

module.exports.readAllThreads = (req, res, next) => {
    const sortOptions = ["recent", "likes", "dislikes"];
    let sortBy = req.query.sort || "recent";

    if (!sortOptions.includes(sortBy)) {
        sortBy = "recent";
    }

    const callback = (error, results, fields) => {
        if (error) {
            return res.status(500).json(error);
        }

        const blockedIds = res.locals.blockList;

        const filteredThreads = results.rows.filter(
            thread => !blockedIds.includes(thread.user_id)
        );

        return res.status(200).json(filteredThreads);
    };

    model.readAllThreads(res.locals.userId, sortBy, callback);
};

module.exports.readThreadById = (req, res, next) => {
    const data = {
        thread_id: req.params.thread_id,
        user_id: res.locals.userId || null
    };

    const callback = (error, results, fields) => {
        if (error) {
            return res.status(500).json(error);
        }

        if (results.rows.length === 0) {
            return res.status(404).json({ error: "Thread not found" });
        }

        return res.status(200).json(results.rows[0]);
    };

    model.readThreadById(data, callback);
};

function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (err) {
        return false;
    }
}

module.exports.createThread = (req, res, next) => {
    if (!res.locals.userId) {
        return res.status(401).json({ error: "Invalid or missing user in token" });
    }

    if (!req.body.location_id || !req.body.title || !req.body.content) {
        return res.status(400).json({ error: "data missing. please fill all fields" });
    }

    if (req.body.image_url && !isValidUrl(req.body.image_url)) {
        return res.status(400).json({ error: "Image URL is not valid" });
    }

    if (req.body.video_url && !isValidUrl(req.body.video_url)) {
        return res.status(400).json({ error: "Video URL is not valid" });
    }

    const data = {
        user_id: res.locals.userId,
        location_id: req.body.location_id,
        title: req.body.title,
        content: req.body.content,
        image_url: req.body.image_url || null,
        video_url: req.body.video_url || null
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("createThread DB error:", error);
            return res.status(500).json(error);
        }

        return res.status(200).json(results.rows[0]);
    };

    model.createThread(data, callback);
};

module.exports.createReply = (req, res, next) => {
    if (!res.locals.userId) {
        return res.status(401).json({ error: "Invalid or missing user in token" });
    }

    if (!req.params.thread_id || !req.body.content) {
        return res.status(400).json({ error: "data missing. please fill all fields" });
    }

    const data = {
        thread_id: req.params.thread_id,
        user_id: res.locals.userId,
        content: req.body.content
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("createReply DB error:", error);
            return res.status(500).json(error);
        }

        return res.status(200).json(results.rows[0]);
    };

    model.createReply(data, callback);
};

module.exports.readRepliesByThreadId = (req, res, next) => {
    const data = {
        thread_id: req.params.thread_id
    };

    const callback = (error, results, fields) => {
        if (error) {
            return res.status(500).json(error);
        }

        const blockedIds = res.locals.blockList;

        const filteredReplies = results.rows.filter(
            reply => !blockedIds.includes(reply.user_id)
        );

        return res.status(200).json(filteredReplies);
    };

    model.readRepliesByThreadId(data, callback);
};

module.exports.deleteThread = (req, res, next) => {
    if (!res.locals.userId) {
        return res.status(401).json({ error: "Invalid or missing user in token" });
    }

    const data = {
        thread_id: req.params.thread_id,
        user_id: res.locals.userId
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("deleteThread DB error:", error);
            return res.status(500).json(error);
        }

        if (results.rowCount === 0) {
            return res.status(403).json({ error: "You can only delete your own thread" });
        }

        return res.status(200).json({
            message: "Thread deleted successfully",
            deletedThread: results.rows[0]
        });
    };

    model.deleteThread(data, callback);
};

module.exports.voteThread = (req, res, next) => {
    if (!res.locals.userId) {
        return res.status(401).json({ error: "Invalid or missing user in token" });
    }

    const voteType = req.body.vote_type;

    if (!voteType || (voteType !== "LIKE" && voteType !== "DISLIKE")) {
        return res.status(400).json({ error: "vote_type must be LIKE or DISLIKE" });
    }

    const data = {
        thread_id: req.params.thread_id,
        user_id: res.locals.userId,
        vote_type: voteType
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("castVote DB error:", error);
            return res.status(500).json(error);
        }

        return res.status(200).json(results.rows[0]);
    };

    model.castVote(data, callback);
};

module.exports.removeVote = (req, res, next) => {
    if (!res.locals.userId) {
        return res.status(401).json({ error: "Invalid or missing user in token" });
    }

    const data = {
        thread_id: req.params.thread_id,
        user_id: res.locals.userId
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("removeVote DB error:", error);
            return res.status(500).json(error);
        }

        return res.status(200).json({
            message: "Vote removed",
            removedVote: results.rows[0] || null
        });
    };

    model.removeVote(data, callback);
};