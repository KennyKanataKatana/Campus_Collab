const pool = require('./db');

async function sendFriendRequest(senderId, receiverId) {
  const existing = await pool.query(
    `
      SELECT *

      FROM friend_requests

      WHERE

      (
        sender_id = $1
        AND receiver_id = $2
      )

      OR

      (
        sender_id = $2
        AND receiver_id = $1
      )
      `,
    [senderId, receiverId],
  );

  if (existing.rows.length > 0) {
    throw new Error('This user is already your friend or has a pending request.');
  }

  const result = await pool.query(
    `
      INSERT INTO friend_requests
      (sender_id, receiver_id)

      VALUES ($1, $2)

      RETURNING *
      `,
    [senderId, receiverId],
  );

  return result.rows[0];
}

async function acceptFriendRequest(id, receiverId) {
  const result = await pool.query(
    `
    UPDATE friend_requests
    SET status = 'ACCEPTED'
    WHERE id = $1
      AND receiver_id = $2
      AND status = 'PENDING'
    RETURNING *
    `,
    [id, receiverId],
  );

  return result.rows[0];
}

async function rejectFriendRequest(id, receiverId) {
  const result = await pool.query(
    `
    UPDATE friend_requests
    SET status = 'REJECTED'
    WHERE id = $1
      AND receiver_id = $2
      AND status = 'PENDING'
    RETURNING *
    `,
    [id, receiverId],
  );

  return result.rows[0];
}

async function getPendingRequests(userId) {
  const result = await pool.query(
    `
    SELECT
      friend_requests.id,

      users.student_name
      AS sender_name,

      friend_requests.status

    FROM friend_requests

    JOIN users
      ON users.id =
      friend_requests.sender_id

    WHERE
      friend_requests.receiver_id = $1
      AND friend_requests.status =
      'PENDING'
    `,
    [userId],
  );

  return result.rows;
}

async function getFriendsList(userId) {
  const result = await pool.query(
    `
    SELECT

      friend_requests.id,

      friend_requests.sender_id,

      friend_requests.receiver_id,

      friend_requests.status,

      friend_requests.created_at,

      sender.student_name
      AS sender_name,

      receiver.student_name
      AS receiver_name

    FROM friend_requests

    JOIN users AS sender
      ON sender.id =
      friend_requests.sender_id

    JOIN users AS receiver
      ON receiver.id =
      friend_requests.receiver_id

    WHERE

    (
      friend_requests.sender_id = $1

      OR

      friend_requests.receiver_id = $1
    )

    AND friend_requests.status =
    'ACCEPTED'
    `,
    [userId],
  );

  return result.rows;
}

async function getSentRequests(userId) {
  const result = await pool.query(
    `
    SELECT
      friend_requests.id,

      users.student_name
      AS receiver_name,

      friend_requests.status

    FROM friend_requests

    JOIN users
      ON users.id =
      friend_requests.receiver_id

    WHERE
      friend_requests.sender_id = $1
      AND friend_requests.status =
      'PENDING'
    `,
    [userId],
  );

  return result.rows;
}

async function searchUsers(name) {
  const result = await pool.query(
    `
    SELECT
      id,
      student_name

    FROM users

    WHERE
      TRIM(student_name)
      ILIKE TRIM($1)

    ORDER BY student_name
    `,
    [`%${name}%`],
  );

  return result.rows;
}

async function getSuggestedFriends(userId) {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.student_name,

      (
        SELECT COUNT(*)

        FROM (

          SELECT
            CASE
              WHEN sender_id = $1
              THEN receiver_id
              ELSE sender_id
            END AS friend_id

          FROM friend_requests

          WHERE
            status = 'ACCEPTED'
            AND
            (
              sender_id = $1
              OR receiver_id = $1
            )

        ) my_friends

        INNER JOIN (

          SELECT
            CASE
              WHEN sender_id = u.id
              THEN receiver_id
              ELSE sender_id
            END AS friend_id

          FROM friend_requests

          WHERE
            status = 'ACCEPTED'
            AND
            (
              sender_id = u.id
              OR receiver_id = u.id
            )

        ) their_friends

        ON my_friends.friend_id =
           their_friends.friend_id

      ) AS mutual_count

    FROM users u

    WHERE u.id != $1

    AND u.id NOT IN (

      SELECT receiver_id
      FROM friend_requests
      WHERE sender_id = $1

      UNION

      SELECT sender_id
      FROM friend_requests
      WHERE receiver_id = $1

    )

    ORDER BY mutual_count DESC,
             u.student_name

    LIMIT 10;
    `,
    [userId],
  );

  return result.rows;
}

async function removeFriend(id, userId) {
  const result = await pool.query(
    `
    DELETE FROM friend_requests
    WHERE id = $1
      AND status = 'ACCEPTED'
      AND (sender_id = $2 OR receiver_id = $2)
    RETURNING *
    `,
    [id, userId],
  );

  return result.rows[0];
}

async function getFriendshipInfo(currentUserId, friendId) {
  const result = await pool.query(
    `
    SELECT created_at

    FROM friend_requests

    WHERE status = 'ACCEPTED'

    AND (

      (sender_id = $1 AND receiver_id = $2)

      OR

      (sender_id = $2 AND receiver_id = $1)

    )

    LIMIT 1
    `,
    [currentUserId, friendId],
  );

  return result.rows[0];
}

async function getMutualFriendCount(currentUserId, profileUserId) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::INTEGER AS mutual_count
    FROM (
      SELECT CASE
        WHEN sender_id = $1 THEN receiver_id
        ELSE sender_id
      END AS friend_id
      FROM friend_requests
      WHERE status = 'ACCEPTED'
        AND (sender_id = $1 OR receiver_id = $1)
    ) AS current_user_friends
    INNER JOIN (
      SELECT CASE
        WHEN sender_id = $2 THEN receiver_id
        ELSE sender_id
      END AS friend_id
      FROM friend_requests
      WHERE status = 'ACCEPTED'
        AND (sender_id = $2 OR receiver_id = $2)
    ) AS profile_user_friends
      ON current_user_friends.friend_id = profile_user_friends.friend_id
    `,
    [currentUserId, profileUserId],
  );

  return result.rows[0].mutual_count;
}

module.exports = {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getSuggestedFriends,
  getPendingRequests,
  getFriendsList,
  getSentRequests,
  searchUsers,
  removeFriend,
  getFriendshipInfo,
  getMutualFriendCount,
};
