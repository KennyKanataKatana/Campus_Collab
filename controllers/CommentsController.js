const model = require(
  "../models/CommentsModel.js"
);

module.exports.readCommentsByPostId =
  function (req, res) {
    const postId = Number(
      req.params.post_id
    );

    if (
      !Number.isInteger(postId) ||
      postId <= 0
    ) {
      return res.status(400).json({
        error: "Invalid post ID."
      });
    }

    const data = {
      post_id: postId
    };

    const callback = function (
      error,
      results
    ) {
      if (error) {
        console.error(
          "Read comments error:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to load comments."
        });
      }

      return res
        .status(200)
        .json(results.rows);
    };

    model.readCommentsByPostId(
      data,
      callback
    );
  };

module.exports.addComment =
  function (req, res) {
    const postId = Number(
      req.params.post_id
    );

    const userId = Number(
      res.locals.userId
    );

    const content =
      typeof req.body.content ===
      "string"
        ? req.body.content.trim()
        : "";

    if (
      !Number.isInteger(postId) ||
      postId <= 0
    ) {
      return res.status(400).json({
        error: "Invalid post ID."
      });
    }

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(401).json({
        error:
          "You must be logged in to comment."
      });
    }

    if (!content) {
      return res.status(400).json({
        error:
          "Comment cannot be empty."
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        error:
          "Comment cannot exceed 500 characters."
      });
    }

    const data = {
      post_id: postId,
      user_id: userId,
      content: content
    };

    const callback = function (
      error,
      results
    ) {
      if (error) {
        console.error(
          "Add comment error:",
          error
        );

        /*
         * PostgreSQL foreign-key error.
         * Usually means the post does not exist.
         */
        if (error.code === "23503") {
          return res.status(404).json({
            error: "Post not found."
          });
        }

        return res.status(500).json({
          error:
            "Unable to add comment."
        });
      }

      return res
        .status(201)
        .json(results.rows[0]);
    };

    model.addComment(
      data,
      callback
    );
  };

module.exports.deleteComment =
  function (req, res) {
    const commentId = Number(
      req.params.comment_id
    );

    const userId = Number(
      res.locals.userId
    );

    if (
      !Number.isInteger(commentId) ||
      commentId <= 0
    ) {
      return res.status(400).json({
        error: "Invalid comment ID."
      });
    }

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(401).json({
        error:
          "You must be logged in to delete a comment."
      });
    }

    const readData = {
      comment_id: commentId
    };

    model.readCommentById(
      readData,
      function (
        readError,
        readResults
      ) {
        if (readError) {
          console.error(
            "Read comment error:",
            readError
          );

          return res.status(500).json({
            error:
              "Unable to check the comment."
          });
        }

        if (
          readResults.rowCount === 0
        ) {
          return res.status(404).json({
            error: "Comment not found."
          });
        }

        const comment =
          readResults.rows[0];

        if (
          String(comment.user_id) !==
          String(userId)
        ) {
          return res.status(403).json({
            error:
              "You can only delete your own comments."
          });
        }

        const deleteData = {
          comment_id: commentId,
          user_id: userId
        };

        model.deleteComment(
          deleteData,
          function (
            deleteError,
            deleteResults
          ) {
            if (deleteError) {
              console.error(
                "Delete comment error:",
                deleteError
              );

              return res
                .status(500)
                .json({
                  error:
                    "Unable to delete comment."
                });
            }

            if (
              deleteResults.rowCount ===
              0
            ) {
              return res
                .status(404)
                .json({
                  error:
                    "Comment not found."
                });
            }

            return res
              .status(200)
              .json({
                message:
                  "Comment deleted successfully.",
                deletedComment:
                  deleteResults.rows[0]
              });
          }
        );
      }
    );
  };