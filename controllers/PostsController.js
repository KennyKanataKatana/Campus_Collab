const model = require("../models/PostsModel.js");

module.exports.readAllPosts = (req, res, next) => {
    const callback = (error, results) => {
        if (error) {
            return res.status(500).json(error);
        }

        const blockedIds = res.locals.blockList;

        const filteredPosts = results.rows.filter(
            post => !blockedIds.includes(post.user_id)
        );

        return res.status(200).json(filteredPosts);
    };

    model.readAllPosts(callback);
};

module.exports.uploadPost = (req, res, next) => {
    /**
        Creates a new post

        {
            "title": "Study Party",
            "description": "Study party for DIT specialisation Immersive tech!",
            "location_id": 1,
            "max_participants": 5
        }
    **/

    if (!req.body.location_id || !req.body.title || !req.body.description ||
        !req.body.max_participants || !req.body.hangout_at) {
        return res.status(400).json({ error: "data missing. please fill all fields" });
    }

    const maxParticipants = Number(req.body.max_participants);
    if (!Number.isInteger(maxParticipants) || maxParticipants < 2 || maxParticipants > 50) {
        return res.status(400).json({ error: "Maximum participants must be between 2 and 50" });
    }

    const hangoutAt = new Date(req.body.hangout_at);
    if (Number.isNaN(hangoutAt.getTime()) || hangoutAt <= new Date()) {
        return res.status(400).json({ error: "Hangout date must be in the future" });
    }

    const data = {
        user_id: res.locals.userId,
        title: req.body.title,
        description: req.body.description,
        location_id: req.body.location_id,
        max_participants: maxParticipants,
        hangout_at: hangoutAt.toISOString()
    };

    const callback = (error, results, fields) => {

        if (error) {
            console.error(error);
            return res.status(500).json(error);
        }

        // Newly created post
        const post = results.rows[0];

        const historyData = {
            original_post_id: post.id,
            user_id: post.user_id,
            title: post.title,
            description: post.description,
            location_id: post.location_id,
            max_participants: post.max_participants,
            created_at: post.created_at
        };

        const historyCallback = (historyError) => {

            if (historyError) {
                console.error("Error creating post history:", historyError);
                return res.status(500).json(historyError);
            }

            return res.status(201).json(post);
        };

        model.createPostHistory(historyData, historyCallback);
    };

    model.uploadPost(data, callback);
};

module.exports.deletePost = (req, res, next) => {
    const data = {
        post_id: req.params.post_id,
        user_id: res.locals.userId
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error(error);
            return res.status(500).json(error);
        }

        if (results.rowCount === 0) {
            return res.status(404).json({ error: "Post not found or you are not its owner" });
        }

        return res.status(200).json({
            message: "Post deleted successfully",
            deletedPost: results.rows[0]
        });
    };

    model.deletePost(data, callback);
};

// READ BOOKMARKS BY USER ID
module.exports.readBookMarksByUserId = (req, res, next) => {
    const data = {
        user_id: res.locals.userId
    };


    const callback = (error, results, fields) => {

        if (error) {
            console.error("Error readBookMarksByUserId:", error);
            res.status(500).json(error);
        } else {
            res.status(200).json(results.rows);
        }
    };

    model.readBookMarksByUserId(data, callback);
};

// BOOKMARK POST
module.exports.bookMarkPost = (req, res, next) => {
    const data = {
        post_id: req.params.post_id,
        user_id: res.locals.userId
    };

    const callback = (error, results, fields) => {
        if (error) {
            console.error("Error bookMarkPost:", error);
            res.status(500).json(error);
        } else {
            res.status(201).json({
                message: "Post bookmarked successfully",
                bookmark: results.rows[0]
            });
        }
    };

    model.bookMarkPost(data, callback);
};