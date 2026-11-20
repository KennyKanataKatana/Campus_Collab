require("dotenv").config({ path: ".env.test" });

const { test, expect } = require("@playwright/test");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const BASE_URL = "http://localhost:3001";

const jwtSecret =
  process.env.JWT_SECRET_KEY ||
  "test-jwt-secret";

const jwtAlgorithm =
  process.env.JWT_ALGORITHM ||
  "HS256";

let postOwnerId;
let commenterId;
let otherUserId;

let locationId;
let seededPostId;

function createToken(userId) {
  return jwt.sign(
    {
      userId
    },
    jwtSecret,
    {
      algorithm: jwtAlgorithm,
      expiresIn: "1h"
    }
  );
}

async function authenticatePage(
  page,
  userId
) {
  await page.addInitScript(
    ({
      sessionToken,
      sessionUserId
    }) => {
      localStorage.setItem(
        "token",
        sessionToken
      );

      localStorage.setItem(
        "userId",
        String(sessionUserId)
      );
    },
    {
      sessionToken:
        createToken(userId),

      sessionUserId:
        userId
    }
  );
}

async function gotoPostPage(
  page,
  {
    userId
  } = {}
) {
  if (userId) {
    await authenticatePage(
      page,
      userId
    );
  }

  await page.goto(
    `${BASE_URL}/post.html`
  );

  await page.waitForSelector(
    "#postsGrid"
  );

  await expect(
    page.locator("#postCount")
  ).not.toContainText(
    /loading posts/i
  );
}

function getPostCard(
  page
) {
  return page
    .locator(".post-card")
    .filter({
      hasText:
        "Comment E2E Hangout"
    });
}

async function openComments(
  page
) {
  const card =
    getPostCard(page);

  await card.getByRole(
    "button",
    {
      name: "Comments",
      exact: true
    }
  ).click();

  await expect(
    card.locator(
      ".comments-panel"
    )
  ).toHaveClass(
    /open/
  );

  return card;
}

async function resetDatabase() {
  await pool.query(
    `
    DELETE FROM hangout_post_comments
    WHERE user_id IN (
      $1,
      $2,
      $3
    );
    `,
    [
      postOwnerId,
      commenterId,
      otherUserId
    ]
  );

  await pool.query(
    `
    DELETE FROM hangout_posts
    WHERE user_id = $1;
    `,
    [
      postOwnerId
    ]
  );
}

async function seedPost() {
  const result =
    await pool.query(
      `
      INSERT INTO hangout_posts (
        user_id,
        title,
        description,
        location_id,
        max_participants,
        current_participants,
        hangout_at
      )
      VALUES (
        $1,
        'Comment E2E Hangout',
        'Post used for comment e2e tests',
        $2,
        5,
        1,
        CURRENT_TIMESTAMP
          + INTERVAL '2 days'
      )
      RETURNING id;
      `,
      [
        postOwnerId,
        locationId
      ]
    );

  seededPostId =
    result.rows[0].id;
}

test.beforeAll(async () => {
  const locationResult =
    await pool.query(
      `
      INSERT INTO sp_locations (
        location_name
      )
      VALUES (
        'Comment E2E Location'
      )
      ON CONFLICT (
        location_name
      )
      DO UPDATE SET
        location_name =
          EXCLUDED.location_name
      RETURNING id;
      `
    );

  const postOwnerResult =
    await pool.query(
      `
      INSERT INTO users (
        student_name,
        student_email,
        password_hash
      )
      VALUES (
        'Comment E2E Owner',
        'comment_e2e_owner@ichat.sp.edu.sg',
        'hashedpassword'
      )
      RETURNING id;
      `
    );

  const commenterResult =
    await pool.query(
      `
      INSERT INTO users (
        student_name,
        student_email,
        password_hash
      )
      VALUES (
        'Comment E2E User',
        'comment_e2e_user@ichat.sp.edu.sg',
        'hashedpassword'
      )
      RETURNING id;
      `
    );

  const otherUserResult =
    await pool.query(
      `
      INSERT INTO users (
        student_name,
        student_email,
        password_hash
      )
      VALUES (
        'Comment E2E Other User',
        'comment_e2e_other@ichat.sp.edu.sg',
        'hashedpassword'
      )
      RETURNING id;
      `
    );

  locationId =
    locationResult.rows[0].id;

  postOwnerId =
    postOwnerResult.rows[0].id;

  commenterId =
    commenterResult.rows[0].id;

  otherUserId =
    otherUserResult.rows[0].id;
});

test.beforeEach(async () => {
  await resetDatabase();
  await seedPost();
});

test.afterEach(async () => {
  await resetDatabase();
});

test.afterAll(async () => {
  await resetDatabase();

  await pool.query(
    `
    DELETE FROM users
    WHERE id IN (
      $1,
      $2,
      $3
    );
    `,
    [
      postOwnerId,
      commenterId,
      otherUserId
    ]
  );

  await pool.query(
    `
    DELETE FROM sp_locations
    WHERE id = $1;
    `,
    [
      locationId
    ]
  );

  await pool.end();
});

test.describe(
  "Comment Panel",
  () => {
    test(
      "should open the comments panel",
      async ({
        page
      }) => {
        await gotoPostPage(
          page,
          {
            userId:
              commenterId
          }
        );

        const card =
          await openComments(
            page
          );

        await expect(
          card.locator(
            ".comments-panel"
          )
        ).toBeVisible();
      }
    );

    test(
      "should show empty state when there are no comments",
      async ({
        page
      }) => {
        await gotoPostPage(
          page,
          {
            userId:
              commenterId
          }
        );

        const card =
          await openComments(
            page
          );

        await expect(
          card.locator(
            ".comments-list"
          )
        ).toContainText(
          "No comments yet"
        );
      }
    );

    test(
      "should show login banner when user is logged out",
      async ({
        page
      }) => {
        await page.goto(
          `${BASE_URL}/post.html`
        );

        await expect(
          page.locator(
            "#loginBanner"
          )
        ).toBeVisible();

        await expect(
          page.locator(
            "#loginBanner"
          )
        ).toContainText(
          /log in|sign up/i
        );

        await expect(
          page.locator(
            "#btnNewPost"
          )
        ).toBeHidden();
      }
    );
  }
);

test.describe(
  "Add Comment",
  () => {
    test(
      "should allow a logged-in user to add a comment",
      async ({
        page
      }) => {
        await gotoPostPage(
          page,
          {
            userId:
              commenterId
          }
        );

        const card =
          await openComments(
            page
          );

        await card.locator(
          ".comment-input"
        ).fill(
          "Comment added from e2e test"
        );

        await card.getByRole(
          "button",
          {
            name:
              "Add Comment"
          }
        ).click();

        await expect(
          card.locator(
            ".comments-list"
          )
        ).toContainText(
          "Comment added from e2e test"
        );

        await expect(
          card.locator(
            ".comments-list"
          )
        ).toContainText(
          "Comment E2E User"
        );

        const dbResult =
          await pool.query(
            `
            SELECT *
            FROM hangout_post_comments
            WHERE post_id = $1
              AND user_id = $2
              AND content = $3;
            `,
            [
              seededPostId,
              commenterId,
              "Comment added from e2e test"
            ]
          );

        expect(
          dbResult.rows
        ).toHaveLength(1);
      }
    );

    test(
      "should show warning for an empty comment",
      async ({
        page
      }) => {
        await gotoPostPage(
          page,
          {
            userId:
              commenterId
          }
        );

        const card =
          await openComments(
            page
          );

        page.once(
          "dialog",
          async (
            dialog
          ) => {
            expect(
              dialog.message()
            ).toMatch(
              /comment cannot be empty/i
            );

            await dialog.accept();
          }
        );

        await card.getByRole(
          "button",
          {
            name:
              "Add Comment"
          }
        ).click();

        const dbResult =
          await pool.query(
            `
            SELECT *
            FROM hangout_post_comments
            WHERE post_id = $1
              AND user_id = $2;
            `,
            [
              seededPostId,
              commenterId
            ]
          );

        expect(
          dbResult.rows
        ).toHaveLength(0);
      }
    );
  }
);

test.describe(
  "Load Comments",
  () => {
    test(
      "should display a seeded comment with author name",
      async ({
        page
      }) => {
        await pool.query(
          `
          INSERT INTO hangout_post_comments (
            post_id,
            user_id,
            content
          )
          VALUES (
            $1,
            $2,
            $3
          );
          `,
          [
            seededPostId,
            commenterId,
            "Seeded comment shown in browser"
          ]
        );

        await gotoPostPage(
          page,
          {
            userId:
              otherUserId
          }
        );

        const card =
          await openComments(
            page
          );

        await expect(
          card.locator(
            ".comments-list"
          )
        ).toContainText(
          "Seeded comment shown in browser"
        );

        await expect(
          card.locator(
            ".comments-list"
          )
        ).toContainText(
          "Comment E2E User"
        );
      }
    );

    test(
      "should only show delete button to the comment owner",
      async ({
        page
      }) => {
        await pool.query(
          `
          INSERT INTO hangout_post_comments (
            post_id,
            user_id,
            content
          )
          VALUES (
            $1,
            $2,
            $3
          );
          `,
          [
            seededPostId,
            commenterId,
            "Owner-only delete comment"
          ]
        );

        await gotoPostPage(
          page,
          {
            userId:
              otherUserId
          }
        );

        const card =
          await openComments(
            page
          );

        await expect(
          card.getByRole(
            "button",
            {
              name: "Delete",
              exact: true
            }
          )
        ).toHaveCount(0);
      }
    );
  }
);

test.describe(
  "Delete Comment",
  () => {
    test(
      "should allow the owner to delete their comment",
      async ({
        page
      }) => {
        const commentResult =
          await pool.query(
            `
            INSERT INTO hangout_post_comments (
              post_id,
              user_id,
              content
            )
            VALUES (
              $1,
              $2,
              $3
            )
            RETURNING id;
            `,
            [
              seededPostId,
              commenterId,
              "Comment to delete"
            ]
          );

        const commentId =
          commentResult.rows[0].id;

        await gotoPostPage(
          page,
          {
            userId:
              commenterId
          }
        );

        const card =
          await openComments(
            page
          );

        page.once(
          "dialog",
          async (
            dialog
          ) => {
            expect(
              dialog.message()
            ).toMatch(
              /delete this comment/i
            );

            await dialog.accept();
          }
        );

        await card.getByRole(
          "button",
          {
            name: "Delete",
            exact: true
          }
        ).click();

        await expect(
          card.locator(
            ".comments-list"
          )
        ).not.toContainText(
          "Comment to delete"
        );

        const dbResult =
          await pool.query(
            `
            SELECT *
            FROM hangout_post_comments
            WHERE id = $1;
            `,
            [
              commentId
            ]
          );

        expect(
          dbResult.rows
        ).toHaveLength(0);
      }
    );

    test(
      "should not delete the comment when confirmation is cancelled",
      async ({
        page
      }) => {
        const commentResult =
          await pool.query(
            `
            INSERT INTO hangout_post_comments (
              post_id,
              user_id,
              content
            )
            VALUES (
              $1,
              $2,
              $3
            )
            RETURNING id;
            `,
            [
              seededPostId,
              commenterId,
              "Comment kept after cancel"
            ]
          );

        const commentId =
          commentResult.rows[0].id;

        await gotoPostPage(
          page,
          {
            userId:
              commenterId
          }
        );

        const card =
          await openComments(
            page
          );

        page.once(
          "dialog",
          async (
            dialog
          ) => {
            await dialog.dismiss();
          }
        );

        await card.getByRole(
          "button",
          {
            name: "Delete",
            exact: true
          }
        ).click();

        await expect(
          card.locator(
            ".comments-list"
          )
        ).toContainText(
          "Comment kept after cancel"
        );

        const dbResult =
          await pool.query(
            `
            SELECT *
            FROM hangout_post_comments
            WHERE id = $1;
            `,
            [
              commentId
            ]
          );

        expect(
          dbResult.rows
        ).toHaveLength(1);
      }
    );
  }
);

test.describe(
  "Comments API Access Control",
  () => {
    test(
      "should reject POST /comments/post/:post_id with no auth token",
      async ({
        request
      }) => {
        const response =
          await request.post(
            `${BASE_URL}/comments/post/${seededPostId}`,
            {
              data: {
                content:
                  "No token comment"
              }
            }
          );

        expect(
          response.status()
        ).toBe(401);
      }
    );

    test(
      "should reject DELETE /comments/:comment_id with no auth token",
      async ({
        request
      }) => {
        const commentResult =
          await pool.query(
            `
            INSERT INTO hangout_post_comments (
              post_id,
              user_id,
              content
            )
            VALUES (
              $1,
              $2,
              $3
            )
            RETURNING id;
            `,
            [
              seededPostId,
              commenterId,
              "API access comment"
            ]
          );

        const response =
          await request.delete(
            `${BASE_URL}/comments/${commentResult.rows[0].id}`
          );

        expect(
          response.status()
        ).toBe(401);
      }
    );

    test(
      "should reject deleting another users comment",
      async ({
        request
      }) => {
        const commentResult =
          await pool.query(
            `
            INSERT INTO hangout_post_comments (
              post_id,
              user_id,
              content
            )
            VALUES (
              $1,
              $2,
              $3
            )
            RETURNING id;
            `,
            [
              seededPostId,
              commenterId,
              "Protected comment"
            ]
          );

        const token =
          createToken(
            otherUserId
          );

        const response =
          await request.delete(
            `${BASE_URL}/comments/${commentResult.rows[0].id}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        expect(
          response.status()
        ).toBe(403);
      }
    );
  }
);