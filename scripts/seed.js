require("dotenv").config();      

const { Pool } = require('pg');
const bcrypt = require("bcrypt");

const pepper = process.env.BCRYPT_PEPPER;
const saltRounds = 10;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const users = [
  {
    student_name: "Sarah Lim",
    student_email: "sarahlim.23@ichat.sp.edu.sg",
    password_hash: "password123",
    bio: "Always looking for study buddies and coffee breaks between classes."
  },
  {
    student_name: "Daniel Lee",
    student_email: "daniellee.23@ichat.sp.edu.sg",
    password_hash: "password123",
    bio: "Enjoys coding, hackathons and solving challenging programming problems."
  },
  {
    student_name: "Amanda Koh",
    student_email: "amandakoh.23@ichat.sp.edu.sg",
    password_hash: "password123",
    bio: "Food lover and explorer of every food spot on campus."
  },
  {
    student_name: "John Tan",
    student_email: "johntan.23@ichat.sp.edu.sg",
    password_hash: "password123",
    bio: "Basketball enthusiast and casual gamer."
  },
  {
    student_name: "Ryan Ong",
    student_email: "ryanong.23@ichat.sp.edu.sg",
    password_hash: "password123",
    bio: "Looking to meet new people and join more campus activities."
  },
  {
    student_name: "aa",
    student_email: "aa@ichat.sp.edu.sg",
    password_hash: "1234",
    bio: "Looking to meet new people and join more campus activities."
  }
];

const spLocations = [
  { location_name: 'SP Library' },
  { location_name: 'SP Food Court 6' },
  { location_name: 'SP Food Court 5' },
  { location_name: 'SP Food Court 4' },
  { location_name: 'SP Hilltop Heaven' },
];

const hangoutPosts = [
  {
    user_id: 1,
    title: 'Study Session',
    description: 'Looking for people to study together',
    location_id: 1,
  },
  {
    user_id: 2,
    title: 'Lunch Hangout',
    description: 'Anyone wants to eat together?',
    location_id: 2,
  },
];

const hangoutAcceptances = [
  {
    post_id: 1,
    user_id: 2,
  },
  {
    post_id: 2,
    user_id: 1,
  },
];

const blockedUsers = [
  {
    blocker_id: 1,
    blocked_id: 3,
  },
  {
    blocker_id: 2,
    blocked_id: 4,
  },
  {
    blocker_id: 5,
    blocked_id: 1,
  },
];

const forumThreads = [
  {
    user_id: 1,
    location_id: 1,
    title: 'Best study spots in SP?',
    content: 'Anyone got good quiet places to mug before exams?',
  },
  {
    user_id: 2,
    location_id: 2,
    title: 'Food Court 6 recommendations',
    content: 'What should I eat there? I always order the same thing.',
  },
  {
    user_id: 3,
    location_id: 5,
    title: 'Hilltop Heaven sunset gang',
    content: 'Anybody hangs out there in the evening?',
  },
];

const forumReplies = [
  {
    thread_id: 1,
    user_id: 2,
    content: 'Library top floor is quite solid if you go early.',
  },
  {
    thread_id: 1,
    user_id: 4,
    content: 'Some classrooms are empty in the afternoon too.',
  },
  {
    thread_id: 2,
    user_id: 1,
    content: 'The chicken rice stall is actually pretty decent.',
  },
  {
    thread_id: 3,
    user_id: 5,
    content: 'Yeah the view is nice near sunset, quite chill.',
  },
];

const reports = [
  {
    reporter_id: 1,
    reported_user_id: 3,
    incident_area: 'Post Page',
    reason: 'Spam hangout posts',
    proof_image_url: 'https://youtu.be/dQw4w9WgXcQ?si=RP-Kh_fTNg-TFFwI',
  },
  {
    reporter_id: 2,
    reported_user_id: 4,
    incident_area: 'Forum Page',
    reason: 'Offensive language',
    proof_image_url: 'https://youtu.be/dQw4w9WgXcQ?si=RP-Kh_fTNg-TFFwI',
  },
];

const bookmarkedPosts = [
  {
    user_id: 1,
    post_id: 2,
  },
  {
    user_id: 2,
    post_id: 1,
  },
  {
    user_id: 3,
    post_id: 1,
  }
];

const friendRequests = [
  {
    sender_id: 1,
    receiver_id: 2,
    status: 'PENDING',
  },
  {
    sender_id: 2,
    receiver_id: 3,
    status: 'ACCEPTED',
  },
  {
    sender_id: 4,
    receiver_id: 1,
    status: 'REJECTED',
  },
];

const hangoutInvitations = [
  {
    post_id: 1,
    sender_id: 1,
    receiver_id: 3,
    status: 'PENDING',
    responded_at: null,
  },
  {
    post_id: 1,
    sender_id: 1,
    receiver_id: 4,
    status: 'PENDING',
    responded_at: null,
  },
  {
    post_id: 2,
    sender_id: 2,
    receiver_id: 5,
    status: 'DECLINED',
    responded_at: new Date(),
  },
  {
    post_id: 2,
    sender_id: 2,
    receiver_id: 6,
    status: 'CANCELLED',
    responded_at: new Date(),
  },
];

const postHistory = [
  {
    original_post_id: 1,
    user_id: 1,
    title: "Study Session",
    description: "Looking for people to study together",
    location_id: 1,
    max_participants: 5,
    created_at: new Date(),
  },
  {
    original_post_id: 2,
    user_id: 2,
    title: "Lunch Hangout",
    description: "Anyone wants to eat together?",
    location_id: 2,
    max_participants: 5,
    created_at: new Date(),
  },
];

async function seed() {
  console.log('Seeding database...');

  for (const user of users) {

    const hashedPassword = await bcrypt.hash(
      user.password_hash + pepper,
      saltRounds
    );

    await pool.query(
      `
      INSERT INTO users
      (student_name, student_email, password_hash, bio)
      VALUES ($1, $2, $3, $4)
      `,
      [
        user.student_name,
        user.student_email,
        hashedPassword,
        user.bio,
      ],
    );
  }

  console.log(`Inserted ${users.length} users.`);

  for (const location of spLocations) {
    await pool.query(
      `
      INSERT INTO sp_locations
      (location_name)
      VALUES ($1)
      `,
      [location.location_name],
    );
  }

  console.log(`Inserted ${spLocations.length} locations.`);

  for (const post of hangoutPosts) {
    await pool.query(
      `
      INSERT INTO hangout_posts
      (user_id, title, description, location_id)
      VALUES ($1, $2, $3, $4)
      `,
      [
        post.user_id,
        post.title,
        post.description,
        post.location_id,
      ],
    );
  }

  console.log(`Inserted ${hangoutPosts.length} posts.`);

  for (const invitation of hangoutInvitations) {
  await pool.query(
    `
    INSERT INTO hangout_invitations
    (post_id, sender_id, receiver_id, status, responded_at)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [
      invitation.post_id,
      invitation.sender_id,
      invitation.receiver_id,
      invitation.status,
      invitation.responded_at,
    ],
  );
}

console.log(`Inserted ${hangoutInvitations.length} hangout invitations.`);

  for (const acceptance of hangoutAcceptances) {
    await pool.query(
      `
      INSERT INTO hangout_acceptances
      (post_id, user_id)
      VALUES ($1, $2)
      `,
      [acceptance.post_id, acceptance.user_id],
    );
  }

  console.log(`Inserted ${hangoutAcceptances.length} hangout acceptances.`);

  for (const block of blockedUsers) {
    await pool.query(
      `
      INSERT INTO blocked_users
      (blocker_id, blocked_id)
      VALUES ($1, $2)
      `,
      [
        block.blocker_id,
        block.blocked_id,
      ],
    );
  }

  console.log(`Inserted ${blockedUsers.length} blocked relationships.`);

  for (const thread of forumThreads) {
    await pool.query(
      `
      INSERT INTO forum_threads
      (user_id, location_id, title, content)
      VALUES ($1, $2, $3, $4)
      `,
      [
        thread.user_id,
        thread.location_id,
        thread.title,
        thread.content,
      ],
    );
  }

  console.log(`Inserted ${forumThreads.length} forum threads.`);

  for (const reply of forumReplies) {
    await pool.query(
      `
      INSERT INTO forum_replies
      (thread_id, user_id, content)
      VALUES ($1, $2, $3)
      `,
      [
        reply.thread_id,
        reply.user_id,
        reply.content,
      ],
    );
  }

  console.log(`Inserted ${forumReplies.length} forum replies.`);

  for (const report of reports) {
    await pool.query(
      `
      INSERT INTO reports
      (reporter_id, reported_user_id, incident_area, reason, proof_image_url)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        report.reporter_id,
        report.reported_user_id,
        report.incident_area,
        report.reason,
        report.proof_image_url,
      ],
    );
  }

  console.log(`Inserted ${reports.length} reports.`);

  for (const request of friendRequests) {
    await pool.query(
      `
      INSERT INTO friend_requests
      (sender_id, receiver_id, status)
      VALUES ($1, $2, $3)
      `,
      [
        request.sender_id,
        request.receiver_id,
        request.status,
      ],
    );
  }

  console.log(`Inserted ${friendRequests.length} friend requests.`);

  for (const bookmark of bookmarkedPosts) {
    await pool.query(
      `
      INSERT INTO bookmarked_posts
      (user_id, post_id)
      VALUES ($1, $2)
      `,
      [
        bookmark.user_id,
        bookmark.post_id,
      ],
    );
  }

  console.log(`Inserted ${bookmarkedPosts.length} bookmarked posts.`);

  for (const history of postHistory) {
    await pool.query(
      `
      INSERT INTO post_history
      (
        original_post_id,
        user_id,
        title,
        description,
        location_id,
        max_participants,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        history.original_post_id,
        history.user_id,
        history.title,
        history.description,
        history.location_id,
        history.max_participants,
        history.created_at,
      ]
    );
  }

  console.log(`Inserted ${postHistory.length} post history records.`);

  
  console.log('Seed data inserted successfully.');
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seeding failed:', err);
    pool.end();
    process.exit(1);
  });

  