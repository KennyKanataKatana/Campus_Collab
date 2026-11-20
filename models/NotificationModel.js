const pool = require('./db');

async function syncSystemNotifications() {
  await pool.query(`
    WITH expired AS (
      UPDATE hangout_invitations AS invitation
      SET status = 'EXPIRED', responded_at = CURRENT_TIMESTAMP
      FROM hangout_posts AS post
      WHERE invitation.post_id = post.id
        AND invitation.status = 'PENDING'
        AND (invitation.expires_at <= CURRENT_TIMESTAMP OR post.hangout_at <= CURRENT_TIMESTAMP)
      RETURNING invitation.id, invitation.receiver_id, invitation.sender_id,
        invitation.post_id
    )
    INSERT INTO notifications
      (user_id, actor_id, post_id, invitation_id, type, dedupe_key, message)
    SELECT receiver_id, sender_id, post_id, id, 'INVITATION_EXPIRED',
      'invitation:' || id || ':expired',
      'Your hangout invitation expired before it was accepted.'
    FROM expired
    ON CONFLICT (dedupe_key) DO NOTHING
  `);

  await pool.query(`
    WITH reminder_recipients AS (
      SELECT post.user_id, post.id AS post_id, post.title, post.hangout_at
      FROM hangout_posts AS post
      WHERE post.hangout_at > CURRENT_TIMESTAMP
        AND post.hangout_at <= CURRENT_TIMESTAMP + INTERVAL '24 hours'
      UNION
      SELECT acceptance.user_id, post.id, post.title, post.hangout_at
      FROM hangout_acceptances AS acceptance
      JOIN hangout_posts AS post ON post.id = acceptance.post_id
      WHERE post.hangout_at > CURRENT_TIMESTAMP
        AND post.hangout_at <= CURRENT_TIMESTAMP + INTERVAL '24 hours'
    )
    INSERT INTO notifications
      (user_id, post_id, type, dedupe_key, message)
    SELECT user_id, post_id, 'HANGOUT_REMINDER',
      'hangout:' || post_id || ':reminder:' || user_id,
      'Reminder: "' || title || '" starts within 24 hours.'
    FROM reminder_recipients
    ON CONFLICT (dedupe_key) DO NOTHING
  `);
}

async function getNotifications(userId) {
  await syncSystemNotifications();

  const result = await pool.query(
    `
      SELECT notification.*, actor.student_name AS actor_name,
        post.title AS hangout_title
      FROM notifications AS notification
      LEFT JOIN users AS actor ON actor.id = notification.actor_id
      LEFT JOIN hangout_posts AS post ON post.id = notification.post_id
      WHERE notification.user_id = $1
      ORDER BY notification.created_at DESC
      LIMIT 100
    `,
    [userId]
  );

  return result.rows;
}

async function getUnreadCount(userId) {
  await syncSystemNotifications();

  const result = await pool.query(
    `SELECT COUNT(*)::INTEGER AS count FROM notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );

  return result.rows[0].count;
}

async function markAsRead(id, userId) {
  const result = await pool.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );

  return result.rows[0];
}

async function markAllAsRead(userId) {
  const result = await pool.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );

  return result.rowCount;
}

module.exports = {
  syncSystemNotifications,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
