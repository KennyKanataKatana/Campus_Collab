const pool = require("./db");

module.exports.readCommentsByPostId = function (
  data,
  callback
) {
  const SQLSTATEMENT = `
    SELECT
      hangout_post_comments.id,
      hangout_post_comments.post_id,
      hangout_post_comments.user_id,
      hangout_post_comments.content,
      hangout_post_comments.created_at,
      users.student_name
    FROM hangout_post_comments
    INNER JOIN users
      ON users.id = hangout_post_comments.user_id
    WHERE hangout_post_comments.post_id = $1
    ORDER BY hangout_post_comments.created_at ASC;
  `;

  const VALUES = [data.post_id];

  pool.query(
    SQLSTATEMENT,
    VALUES,
    callback
  );
};

module.exports.addComment = function (
  data,
  callback
) {
  const SQLSTATEMENT = `
    INSERT INTO hangout_post_comments (
      post_id,
      user_id,
      content
    )
    VALUES ($1, $2, $3)
    RETURNING *;
  `;

  const VALUES = [
    data.post_id,
    data.user_id,
    data.content
  ];

  pool.query(
    SQLSTATEMENT,
    VALUES,
    callback
  );
};

module.exports.readCommentById = function (
  data,
  callback
) {
  const SQLSTATEMENT = `
    SELECT *
    FROM hangout_post_comments
    WHERE id = $1;
  `;

  const VALUES = [
    data.comment_id
  ];

  pool.query(
    SQLSTATEMENT,
    VALUES,
    callback
  );
};

module.exports.deleteComment = function (
  data,
  callback
) {
  const SQLSTATEMENT = `
    DELETE FROM hangout_post_comments
    WHERE id = $1
      AND user_id = $2
    RETURNING *;
  `;

  const VALUES = [
    data.comment_id,
    data.user_id
  ];

  pool.query(
    SQLSTATEMENT,
    VALUES,
    callback
  );
};