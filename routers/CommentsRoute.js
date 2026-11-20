const express = require("express");
const router = express.Router();

const controller = require("../controllers/CommentsController.js");
const jwtMiddleware = require("../middlewares/jwtMiddleware.js");
const muteMiddleware = require("../middlewares/muteMiddleware.js");

/*
 * GET /comments/post/:post_id
 * Public route for reading comments under a post.
 */
router.get(
  "/post/:post_id",
  controller.readCommentsByPostId
);

/*
 * POST /comments/post/:post_id
 * User must be logged in and must not be muted.
 */
router.post(
  "/post/:post_id",
  jwtMiddleware.verifyToken,
  muteMiddleware.checkIfMuted,
  controller.addComment
);

/*
 * DELETE /comments/:comment_id
 * User must be logged in.
 * Controller checks that the user owns the comment.
 */
router.delete(
  "/:comment_id",
  jwtMiddleware.verifyToken,
  controller.deleteComment
);

module.exports = router;