const pool = require('./db');

async function createInvitation(postId, senderId, receiverId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const postResult = await client.query(
      `SELECT post.*,
         1 + (SELECT COUNT(*)::INTEGER FROM hangout_acceptances
              WHERE post_id = post.id) AS participant_count
       FROM hangout_posts AS post WHERE post.id = $1 FOR UPDATE OF post`,
      [postId],
    );
    const post = postResult.rows[0];

    if (!post) throw new Error('Hangout not found.');
    if (Number(post.user_id) !== Number(senderId)) {
      throw new Error('Only the hangout owner can invite friends.');
    }
    if (Number(senderId) === Number(receiverId)) {
      throw new Error('You cannot invite yourself.');
    }
    if (new Date(post.hangout_at) <= new Date()) {
      throw new Error('This hangout has already started or expired.');
    }
    if (Number(post.participant_count) >= Number(post.max_participants)) {
      throw new Error('This hangout is already full.');
    }

    const friendResult = await client.query(
      `SELECT 1 FROM friend_requests
       WHERE status = 'ACCEPTED'
         AND ((sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1))
       LIMIT 1`,
      [senderId, receiverId],
    );
    if (friendResult.rows.length === 0) {
      throw new Error('You can only invite accepted friends.');
    }

    const participantResult = await client.query(
      `SELECT 1 FROM hangout_acceptances
       WHERE post_id = $1 AND user_id = $2 LIMIT 1`,
      [postId, receiverId],
    );
    if (participantResult.rows.length > 0) {
      throw new Error('This friend has already joined the hangout.');
    }

    await client.query(
      `UPDATE hangout_invitations SET status = 'EXPIRED', responded_at = CURRENT_TIMESTAMP
       WHERE post_id = $1 AND status = 'PENDING' AND expires_at <= CURRENT_TIMESTAMP`,
      [postId],
    );

    const duplicateResult = await client.query(
      `SELECT 1 FROM hangout_invitations
       WHERE post_id = $1 AND receiver_id = $2 AND status = 'PENDING' LIMIT 1`,
      [postId, receiverId],
    );
    if (duplicateResult.rows.length > 0) {
      throw new Error('A pending invitation has already been sent to this user.');
    }

    const result = await client.query(
      `INSERT INTO hangout_invitations (post_id, sender_id, receiver_id, expires_at)
       VALUES ($1, $2, $3, LEAST(CURRENT_TIMESTAMP + INTERVAL '7 days', $4::timestamptz))
       RETURNING *`,
      [postId, senderId, receiverId, post.hangout_at],
    );
    const invitation = result.rows[0];

    await client.query(
      `INSERT INTO notifications
        (user_id, actor_id, post_id, invitation_id, type, dedupe_key, message)
       VALUES ($1, $2, $3, $4, 'INVITATION_RECEIVED', $5, $6)`,
      [
        receiverId,
        senderId,
        postId,
        invitation.id,
        `invitation:${invitation.id}:received`,
        `You were invited to "${post.title}".`,
      ],
    );

    await client.query('COMMIT');
    return invitation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function isPostOwner(postId, userId) {
  const result = await pool.query(
    `
      SELECT id
      FROM hangout_posts
      WHERE id = $1
      AND user_id = $2
    `,
    [postId, userId],
  );

  return result.rows.length > 0;
}

async function expirePendingInvitations() {
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
}

async function getInvitationById(id) {
  await expirePendingInvitations();

  const result = await pool.query(
    `
    SELECT

      hangout_invitations.id,

      hangout_invitations.post_id,

      hangout_invitations.sender_id,

      hangout_invitations.receiver_id,

      hangout_invitations.status,

      hangout_invitations.created_at,

      hangout_invitations.expires_at,

      hangout_invitations.responded_at,

      hangout_posts.title
      AS hangout_title,

      sender.student_name
      AS sender_name,

      receiver.student_name
      AS receiver_name

    FROM hangout_invitations

    JOIN hangout_posts
      ON hangout_posts.id =
      hangout_invitations.post_id

    JOIN users AS sender
      ON sender.id =
      hangout_invitations.sender_id

    JOIN users AS receiver
      ON receiver.id =
      hangout_invitations.receiver_id

    WHERE hangout_invitations.id = $1
    `,
    [id],
  );

  return result.rows[0];
}

async function getReceivedInvitations(userId) {
  await expirePendingInvitations();

  const result = await pool.query(
    `
    SELECT

      hangout_invitations.id,

      hangout_invitations.post_id,

      hangout_invitations.sender_id,

      hangout_invitations.receiver_id,

      hangout_invitations.status,

      hangout_invitations.created_at,

      hangout_invitations.expires_at,

      hangout_invitations.responded_at,

      hangout_posts.title
      AS hangout_title,

      hangout_posts.description,

      hangout_posts.hangout_at,

      sp_locations.location_name,

      users.student_name
      AS sender_name

    FROM hangout_invitations

    JOIN hangout_posts
      ON hangout_posts.id =
      hangout_invitations.post_id

    JOIN users
      ON users.id =
      hangout_invitations.sender_id

    JOIN sp_locations
      ON sp_locations.id =
      hangout_posts.location_id

    WHERE
      hangout_invitations.receiver_id = $1

    ORDER BY
      hangout_invitations.created_at DESC
    `,
    [userId],
  );

  return result.rows;
}

async function getSentInvitations(userId) {
  await expirePendingInvitations();

  const result = await pool.query(
    `
    SELECT

      hangout_invitations.id,

      hangout_invitations.post_id,

      hangout_invitations.sender_id,

      hangout_invitations.receiver_id,

      hangout_invitations.status,

      hangout_invitations.created_at,

      hangout_invitations.expires_at,

      hangout_invitations.responded_at,

      hangout_posts.title
      AS hangout_title,

      hangout_posts.hangout_at,

      users.student_name
      AS receiver_name

    FROM hangout_invitations

    JOIN hangout_posts
      ON hangout_posts.id =
      hangout_invitations.post_id

    JOIN users
      ON users.id =
      hangout_invitations.receiver_id

    WHERE
      hangout_invitations.sender_id = $1

    ORDER BY
      hangout_invitations.created_at DESC
    `,
    [userId],
  );

  return result.rows;
}

async function declineInvitation(id, receiverId) {
  const result = await pool.query(
    `WITH updated AS (
       UPDATE hangout_invitations
       SET status = 'DECLINED', responded_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND receiver_id = $2 AND status = 'PENDING'
       RETURNING *
     ), notified AS (
       INSERT INTO notifications
         (user_id, actor_id, post_id, invitation_id, type, dedupe_key, message)
       SELECT sender_id, receiver_id, post_id, id, 'INVITATION_DECLINED',
         'invitation:' || id || ':declined',
         'Your hangout invitation was declined.'
       FROM updated
     )
     SELECT * FROM updated`,
    [id, receiverId],
  );
  return result.rows[0];
}

async function cancelInvitation(id, senderId) {
  const result = await pool.query(
    `WITH updated AS (
       UPDATE hangout_invitations
       SET status = 'CANCELLED', responded_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND sender_id = $2 AND status = 'PENDING'
       RETURNING *
     ), notified AS (
       INSERT INTO notifications
         (user_id, actor_id, post_id, invitation_id, type, dedupe_key, message)
       SELECT receiver_id, sender_id, post_id, id, 'INVITATION_CANCELLED',
         'invitation:' || id || ':cancelled',
         'A hangout invitation sent to you was cancelled.'
       FROM updated
     )
     SELECT * FROM updated`,
    [id, senderId],
  );
  return result.rows[0];
}

async function acceptInvitation(invitationId, receiverId) {
  await expirePendingInvitations();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const invitationResult = await client.query(
      `
        SELECT invitation.id, invitation.post_id, invitation.sender_id,
          invitation.receiver_id, invitation.status, invitation.expires_at,
          post.title, post.hangout_at, post.max_participants,
          1 + (SELECT COUNT(*)::INTEGER FROM hangout_acceptances
               WHERE post_id = post.id) AS participant_count
        FROM hangout_invitations AS invitation
        JOIN hangout_posts AS post ON post.id = invitation.post_id
        WHERE invitation.id = $1
        FOR UPDATE OF invitation, post
        `,
      [invitationId],
    );

    const invitation = invitationResult.rows[0];

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    if (Number(invitation.receiver_id) !== Number(receiverId)) {
      throw new Error('You are not allowed to accept this invitation.');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error('This invitation is no longer pending.');
    }

    if (
      new Date(invitation.expires_at) <= new Date() ||
      new Date(invitation.hangout_at) <= new Date()
    ) {
      throw new Error('This invitation has expired.');
    }

    if (Number(invitation.participant_count) >= Number(invitation.max_participants)) {
      throw new Error('This hangout is already full.');
    }

    const existingAcceptance = await client.query(
      `
        SELECT id

        FROM hangout_acceptances

        WHERE user_id = $1

        LIMIT 1
        `,
      [receiverId],
    );

    if (existingAcceptance.rows.length > 0) {
      throw new Error('You are already participating in another hangout.');
    }

    await client.query(
      `
      INSERT INTO hangout_acceptances
      (
        post_id,
        user_id
      )

      VALUES ($1, $2)
      `,
      [invitation.post_id, receiverId],
    );

    await client.query(
      `UPDATE hangout_posts
       SET current_participants = current_participants + 1
       WHERE id = $1`,
      [invitation.post_id],
    );

    const acceptedResult = await client.query(
      `
        UPDATE hangout_invitations

        SET
          status = 'ACCEPTED',
          responded_at =
            CURRENT_TIMESTAMP

        WHERE id = $1

        RETURNING *
        `,
      [invitationId],
    );

    await client.query(
      `INSERT INTO notifications
        (user_id, actor_id, post_id, invitation_id, type, dedupe_key, message)
       VALUES ($1, $2, $3, $4, 'INVITATION_ACCEPTED', $5, $6)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        invitation.sender_id,
        receiverId,
        invitation.post_id,
        invitationId,
        `invitation:${invitationId}:accepted`,
        `Your invitation to "${invitation.title}" was accepted.`,
      ],
    );

    await client.query(
      `WITH declined AS (
         UPDATE hangout_invitations
         SET status = 'DECLINED', responded_at = CURRENT_TIMESTAMP
         WHERE receiver_id = $1 AND id <> $2 AND status = 'PENDING'
         RETURNING *
       )
       INSERT INTO notifications
         (user_id, actor_id, post_id, invitation_id, type, dedupe_key, message)
       SELECT sender_id, receiver_id, post_id, id, 'INVITATION_DECLINED',
         'invitation:' || id || ':declined',
         'Your invitation was declined because the user joined another hangout.'
       FROM declined
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [receiverId, invitationId],
    );

    await client.query('COMMIT');

    return acceptedResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');

    throw error;
  } finally {
    client.release();
  }
}

async function getInvitableFriends(userId, postId) {
  // Do not let an expired pending invitation keep a friend hidden from the
  // picker until the user happens to visit the invitations page.
  await expirePendingInvitations();

  const result = await pool.query(
    `
    SELECT

      users.id,

      users.student_name

    FROM friend_requests

    JOIN users
      ON users.id =
      CASE

        WHEN friend_requests.sender_id = $1
        THEN friend_requests.receiver_id

        ELSE friend_requests.sender_id

      END

    WHERE
      friend_requests.status = 'ACCEPTED'

      AND EXISTS
      (
        SELECT 1
        FROM hangout_posts AS post
        WHERE post.id = $2
          AND post.user_id = $1
          AND post.hangout_at > CURRENT_TIMESTAMP
          AND 1 + (SELECT COUNT(*) FROM hangout_acceptances
                   WHERE post_id = post.id) < post.max_participants
      )

      AND
      (
        friend_requests.sender_id = $1
        OR friend_requests.receiver_id = $1
      )

      AND users.id NOT IN
      (
        SELECT receiver_id

        FROM hangout_invitations

        WHERE
          post_id = $2
          AND status = 'PENDING'
      )

      AND users.id NOT IN
      (
        SELECT user_id

        FROM hangout_acceptances

        WHERE post_id = $2
      )

    ORDER BY users.student_name
    `,
    [userId, postId],
  );

  return result.rows;
}

module.exports = {
  createInvitation,
  isPostOwner,
  getInvitationById,
  getReceivedInvitations,
  getSentInvitations,
  declineInvitation,
  cancelInvitation,
  acceptInvitation,
  getInvitableFriends,
};
