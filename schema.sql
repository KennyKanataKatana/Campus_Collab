DROP TABLE IF EXISTS hangout_check_ins CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS post_history CASCADE;
DROP TABLE IF EXISTS appeals CASCADE;
DROP TABLE IF EXISTS hangout_invitations CASCADE;
DROP TABLE IF EXISTS hangout_post_comments CASCADE;
DROP TABLE IF EXISTS friend_requests CASCADE;
DROP TABLE IF EXISTS bookmarked_posts CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS blocked_users CASCADE;
DROP TABLE IF EXISTS forum_replies CASCADE;
DROP TABLE IF EXISTS forum_thread_votes CASCADE;
DROP TABLE IF EXISTS forum_threads CASCADE;
DROP TABLE IF EXISTS hangout_acceptances CASCADE;
DROP TABLE IF EXISTS hangout_posts CASCADE;
DROP TABLE IF EXISTS sp_locations CASCADE;
DROP TABLE IF EXISTS users CASCADE;


-- ====================================================
-- USERS
-- ====================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,

    student_name VARCHAR(100) NOT NULL,

    student_email VARCHAR(100) UNIQUE NOT NULL
        CHECK (student_email LIKE '%@ichat.sp.edu.sg'),

    password_hash TEXT NOT NULL,

    bio TEXT NOT NULL
        DEFAULT 'This user has not set a bio yet.',

    is_muted BOOLEAN NOT NULL
        DEFAULT FALSE,

    muted_at TIMESTAMP DEFAULT NULL,

    mute_until TIMESTAMP DEFAULT NULL,

    muted_reason TEXT DEFAULT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


-- ====================================================
-- SP LOCATIONS
-- ====================================================

CREATE TABLE sp_locations (
    id SERIAL PRIMARY KEY,

    location_name VARCHAR(100)
        UNIQUE NOT NULL
);


-- ====================================================
-- HANGOUT POSTS
-- ====================================================

CREATE TABLE hangout_posts (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL,

    title VARCHAR(100) NOT NULL,

    description TEXT NOT NULL,

    location_id INTEGER NOT NULL,

    max_participants INTEGER
        NOT NULL
        DEFAULT 5
        CHECK (
            max_participants > 0
            AND max_participants <= 100
        ),

    current_participants INTEGER
        NOT NULL
        DEFAULT 1
        CHECK (
            current_participants >= 1
            AND current_participants <= max_participants
        ),

    hangout_at TIMESTAMPTZ
        NOT NULL
        DEFAULT (
            CURRENT_TIMESTAMP
            + INTERVAL '7 days'
        ),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_hangout_post_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_hangout_post_location
        FOREIGN KEY (location_id)
        REFERENCES sp_locations(id)
        ON DELETE CASCADE
);


-- ====================================================
-- HANGOUT INVITATIONS
-- ====================================================

CREATE TABLE hangout_invitations (
    id SERIAL PRIMARY KEY,

    post_id INTEGER NOT NULL,

    sender_id INTEGER NOT NULL,

    receiver_id INTEGER NOT NULL,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'ACCEPTED',
                'DECLINED',
                'CANCELLED',
                'EXPIRED'
            )
        ),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    expires_at TIMESTAMPTZ
        NOT NULL
        DEFAULT (
            CURRENT_TIMESTAMP
            + INTERVAL '7 days'
        ),

    responded_at TIMESTAMPTZ
        DEFAULT NULL,

    CONSTRAINT fk_invitation_post
        FOREIGN KEY (post_id)
        REFERENCES hangout_posts(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_invitation_sender
        FOREIGN KEY (sender_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_invitation_receiver
        FOREIGN KEY (receiver_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT no_self_invitation
        CHECK (sender_id != receiver_id),

    CONSTRAINT valid_invitation_response_time
        CHECK (
            (
                status = 'PENDING'
                AND responded_at IS NULL
            )
            OR
            (
                status IN (
                    'ACCEPTED',
                    'DECLINED',
                    'CANCELLED',
                    'EXPIRED'
                )
                AND responded_at IS NOT NULL
            )
        )
);


-- ====================================================
-- NOTIFICATIONS
-- ====================================================

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL,

    actor_id INTEGER DEFAULT NULL,

    post_id INTEGER DEFAULT NULL,

    invitation_id INTEGER DEFAULT NULL,

    type VARCHAR(40) NOT NULL
        CHECK (
            type IN (
                'INVITATION_RECEIVED',
                'INVITATION_ACCEPTED',
                'INVITATION_DECLINED',
                'INVITATION_CANCELLED',
                'HANGOUT_CANCELLED',
                'HANGOUT_REMINDER',
                'INVITATION_EXPIRED'
            )
        ),

    dedupe_key TEXT UNIQUE,

    message TEXT NOT NULL,

    read_at TIMESTAMPTZ
        DEFAULT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notification_actor
        FOREIGN KEY (actor_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_notification_post
        FOREIGN KEY (post_id)
        REFERENCES hangout_posts(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_notification_invitation
        FOREIGN KEY (invitation_id)
        REFERENCES hangout_invitations(id)
        ON DELETE SET NULL
);


-- ====================================================
-- HANGOUT ACCEPTANCES
-- ====================================================

CREATE TABLE hangout_acceptances (
    id SERIAL PRIMARY KEY,

    post_id INTEGER NOT NULL,

    user_id INTEGER NOT NULL,

    accepted_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_acceptance_post
        FOREIGN KEY (post_id)
        REFERENCES hangout_posts(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_acceptance_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_acceptance
        UNIQUE (post_id, user_id),

    CONSTRAINT unique_user_acceptance
        UNIQUE (user_id)
);


-- ====================================================
-- HANGOUT CHECK-INS
-- ====================================================

CREATE TABLE hangout_check_ins (
    id SERIAL PRIMARY KEY,

    post_id INTEGER NOT NULL,

    user_id INTEGER NOT NULL,

    checked_in_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_check_in_post
        FOREIGN KEY (post_id)
        REFERENCES hangout_posts(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_check_in_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_check_in
        UNIQUE (post_id, user_id)
);


-- ====================================================
-- HANGOUT POST COMMENTS
-- ====================================================

CREATE TABLE hangout_post_comments (
    id SERIAL PRIMARY KEY,

    post_id INTEGER NOT NULL,

    user_id INTEGER NOT NULL,

    content TEXT NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_comment_post
        FOREIGN KEY (post_id)
        REFERENCES hangout_posts(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_comment_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ====================================================
-- BLOCKED USERS
-- ====================================================

CREATE TABLE blocked_users (
    id SERIAL PRIMARY KEY,

    blocker_id INTEGER NOT NULL,

    blocked_id INTEGER NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_blocker
        FOREIGN KEY (blocker_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_blocked
        FOREIGN KEY (blocked_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_block
        UNIQUE (blocker_id, blocked_id),

    CONSTRAINT no_self_block
        CHECK (blocker_id != blocked_id)
);


-- ====================================================
-- FORUM THREADS
-- ====================================================

CREATE TABLE forum_threads (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL,

    location_id INTEGER NOT NULL,

    title VARCHAR(150) NOT NULL,

    content TEXT NOT NULL,

    image_url TEXT DEFAULT NULL,

    video_url TEXT DEFAULT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_forum_thread_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_forum_thread_location
        FOREIGN KEY (location_id)
        REFERENCES sp_locations(id)
        ON DELETE CASCADE
);


-- ====================================================
-- FORUM REPLIES
-- ====================================================

CREATE TABLE forum_replies (
    id SERIAL PRIMARY KEY,

    thread_id INTEGER NOT NULL,

    user_id INTEGER NOT NULL,

    content TEXT NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_forum_reply_thread
        FOREIGN KEY (thread_id)
        REFERENCES forum_threads(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_forum_reply_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ====================================================
-- FORUM THREAD VOTES
-- ====================================================

CREATE TABLE forum_thread_votes (
    id SERIAL PRIMARY KEY,

    thread_id INTEGER NOT NULL,

    user_id INTEGER NOT NULL,

    vote_type VARCHAR(10) NOT NULL
        CHECK (
            vote_type IN (
                'LIKE',
                'DISLIKE'
            )
        ),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_vote_thread
        FOREIGN KEY (thread_id)
        REFERENCES forum_threads(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_vote_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_thread_vote
        UNIQUE (thread_id, user_id)
);


-- ====================================================
-- REPORTS
-- ====================================================

CREATE TABLE reports (
    id SERIAL PRIMARY KEY,

    reporter_id INTEGER NOT NULL,

    reported_user_id INTEGER NOT NULL,

    incident_area VARCHAR(50) NOT NULL
        CHECK (
            incident_area IN (
                'Forum Page',
                'Post Page',
                'Friends Page',
                'General'
            )
        ),

    reason TEXT NOT NULL,

    proof_image_url TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reporter
        FOREIGN KEY (reporter_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reported_user
        FOREIGN KEY (reported_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT no_self_report
        CHECK (
            reporter_id != reported_user_id
        )
);


-- ====================================================
-- APPEALS
-- ====================================================

CREATE TABLE appeals (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL,

    report_id INTEGER DEFAULT NULL,

    reason TEXT NOT NULL,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED'
            )
        ),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_appeal_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_appeal_report
        FOREIGN KEY (report_id)
        REFERENCES reports(id)
        ON DELETE SET NULL
);


-- ====================================================
-- BOOKMARKED POSTS
-- ====================================================

CREATE TABLE bookmarked_posts (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL,

    post_id INTEGER NOT NULL,

    bookmarked_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bookmark_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_bookmark_post
        FOREIGN KEY (post_id)
        REFERENCES hangout_posts(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_bookmark
        UNIQUE (user_id, post_id)
);


-- ====================================================
-- FRIEND REQUESTS
-- ====================================================

CREATE TABLE friend_requests (
    id SERIAL PRIMARY KEY,

    sender_id INTEGER NOT NULL,

    receiver_id INTEGER NOT NULL,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'ACCEPTED',
                'REJECTED'
            )
        ),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_friend_sender
        FOREIGN KEY (sender_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_friend_receiver
        FOREIGN KEY (receiver_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_friend_request
        UNIQUE (sender_id, receiver_id),

    CONSTRAINT no_self_friend
        CHECK (sender_id != receiver_id)
);


-- ====================================================
-- POST HISTORY
-- ====================================================

CREATE TABLE post_history (
    id SERIAL PRIMARY KEY,

    original_post_id INTEGER,

    user_id INTEGER NOT NULL,

    title VARCHAR(100) NOT NULL,

    description TEXT NOT NULL,

    location_id INTEGER NOT NULL,

    max_participants INTEGER NOT NULL,

    created_at TIMESTAMP NOT NULL,

    archived_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_history_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_history_location
        FOREIGN KEY (location_id)
        REFERENCES sp_locations(id)
        ON DELETE CASCADE
);


-- ====================================================
-- INDEXES
-- ====================================================

CREATE INDEX idx_hangout_location
ON hangout_posts(location_id);

CREATE INDEX idx_hangout_user
ON hangout_posts(user_id);

CREATE INDEX idx_hangout_date
ON hangout_posts(hangout_at);

CREATE INDEX idx_acceptance_post
ON hangout_acceptances(post_id);

CREATE INDEX idx_acceptance_user
ON hangout_acceptances(user_id);

CREATE INDEX idx_check_in_post
ON hangout_check_ins(post_id);

CREATE INDEX idx_check_in_user
ON hangout_check_ins(user_id);

CREATE INDEX idx_forum_thread_user
ON forum_threads(user_id);

CREATE INDEX idx_forum_thread_location
ON forum_threads(location_id);

CREATE INDEX idx_forum_reply_thread
ON forum_replies(thread_id);

CREATE INDEX idx_forum_reply_user
ON forum_replies(user_id);

CREATE INDEX idx_vote_thread
ON forum_thread_votes(thread_id);

CREATE INDEX idx_vote_user
ON forum_thread_votes(user_id);

CREATE INDEX idx_reports_reporter
ON reports(reporter_id);

CREATE INDEX idx_reports_reported_user
ON reports(reported_user_id);

CREATE INDEX idx_reports_incident_area
ON reports(incident_area);

CREATE INDEX idx_appeal_user
ON appeals(user_id);

CREATE INDEX idx_appeal_status
ON appeals(status);

CREATE INDEX idx_bookmark_user
ON bookmarked_posts(user_id);

CREATE INDEX idx_bookmark_post
ON bookmarked_posts(post_id);

CREATE INDEX idx_invitation_post
ON hangout_invitations(post_id);

CREATE INDEX idx_invitation_sender
ON hangout_invitations(sender_id);

CREATE INDEX idx_invitation_receiver
ON hangout_invitations(receiver_id);

CREATE INDEX idx_invitation_status
ON hangout_invitations(status);

CREATE INDEX idx_comment_post
ON hangout_post_comments(post_id);

CREATE INDEX idx_comment_user
ON hangout_post_comments(user_id);

CREATE INDEX idx_invitation_expiry
ON hangout_invitations(expires_at)
WHERE status = 'PENDING';

CREATE INDEX idx_notification_user
ON notifications(user_id);

CREATE INDEX idx_notification_created
ON notifications(created_at DESC);

CREATE INDEX idx_notification_user_unread
ON notifications(user_id, created_at DESC)
WHERE read_at IS NULL;

CREATE INDEX idx_post_history_user
ON post_history(user_id);

CREATE INDEX idx_post_history_created
ON post_history(created_at);


-- ====================================================
-- UNIQUE PARTIAL INDEXES
-- ====================================================

CREATE UNIQUE INDEX unique_pending_hangout_invitation
ON hangout_invitations(post_id, receiver_id)
WHERE status = 'PENDING';