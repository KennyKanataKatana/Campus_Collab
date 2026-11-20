require('dotenv').config({ path: '.env.dev' });
const pool = require('../src/models/db');

const migration = `
  BEGIN;
  ALTER TABLE hangout_posts
    ADD COLUMN IF NOT EXISTS hangout_at TIMESTAMPTZ;
  UPDATE hangout_posts
    SET hangout_at = created_at + INTERVAL '7 days'
    WHERE hangout_at IS NULL;
  ALTER TABLE hangout_posts
    ALTER COLUMN hangout_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    ALTER COLUMN hangout_at SET NOT NULL;

  ALTER TABLE hangout_invitations
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
  UPDATE hangout_invitations AS invitation
    SET expires_at = LEAST(invitation.created_at + INTERVAL '7 days', post.hangout_at)
    FROM hangout_posts AS post
    WHERE invitation.post_id = post.id AND invitation.expires_at IS NULL;
  ALTER TABLE hangout_invitations
    ALTER COLUMN expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    ALTER COLUMN expires_at SET NOT NULL;

  ALTER TABLE hangout_invitations
    DROP CONSTRAINT IF EXISTS hangout_invitations_status_check,
    DROP CONSTRAINT IF EXISTS valid_invitation_response_time;
  ALTER TABLE hangout_invitations
    ADD CONSTRAINT hangout_invitations_status_check
      CHECK(status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED')),
    ADD CONSTRAINT valid_invitation_response_time CHECK(
      (status = 'PENDING' AND responded_at IS NULL)
      OR (status IN ('ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED') AND responded_at IS NOT NULL)
    );

  CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    post_id INTEGER REFERENCES hangout_posts(id) ON DELETE SET NULL,
    invitation_id INTEGER REFERENCES hangout_invitations(id) ON DELETE SET NULL,
    type VARCHAR(40) NOT NULL CHECK(type IN (
      'INVITATION_RECEIVED', 'INVITATION_ACCEPTED', 'INVITATION_DECLINED',
      'INVITATION_CANCELLED', 'HANGOUT_CANCELLED', 'HANGOUT_REMINDER',
      'INVITATION_EXPIRED'
    )),
    dedupe_key TEXT UNIQUE,
    message TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_invitation_expiry
    ON hangout_invitations(expires_at) WHERE status = 'PENDING';
  CREATE INDEX IF NOT EXISTS idx_notification_user_unread
    ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
  COMMIT;
`;

async function migrate() {
  try {
    await pool.query(migration);
    console.log('Invitation enhancements migration completed.');
  } finally {
    await pool.end();
  }
}

migrate().catch(error => {
  console.error('Invitation enhancements migration failed:', error);
  process.exitCode = 1;
});
