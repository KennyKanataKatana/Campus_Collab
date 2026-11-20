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

let hostAId;
let hostBId;
let participantId;

let locationId;

let availablePostId;
let secondPostId;
let fullPostId;

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

async function gotoPostPage(
  page,
  {
    userId
  } = {}
) {
  if (userId) {
    const token =
      createToken(userId);

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
        sessionToken: token,
        sessionUserId: userId
      }
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
  page,
  title
) {
  return page
    .locator(".post-card")
    .filter({
      hasText: title
    });
}

async function resetDatabase() {
  await pool.query(
    `
    DELETE FROM hangout_check_ins
    WHERE user_id IN (
      $1,
      $2,
      $3
    );
    `,
    [
      hostAId,
      hostBId,
      participantId
    ]
  );

  await pool.query(
    `
    DELETE FROM hangout_acceptances
    WHERE user_id IN (
      $1,
      $2,
      $3
    );
    `,
    [
      hostAId,
      hostBId,
      participantId
    ]
  );

  await pool.query(
    `
    DELETE FROM hangout_posts
    WHERE user_id IN (
      $1,
      $2
    );
    `,
    [
      hostAId,
      hostBId
    ]
  );
}

async function seedPosts() {
  const availablePostResult =
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
        'Accept E2E Available Hangout',
        'Available hangout for accept e2e tests',
        $2,
        5,
        1,
        CURRENT_TIMESTAMP
          + INTERVAL '2 days'
      )
      RETURNING id;
      `,
      [
        hostAId,
        locationId
      ]
    );

  const secondPostResult =
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
        'Accept E2E Second Hangout',
        'Second hangout for one active acceptance tests',
        $2,
        5,
        1,
        CURRENT_TIMESTAMP
          + INTERVAL '3 days'
      )
      RETURNING id;
      `,
      [
        hostBId,
        locationId
      ]
    );

  const fullPostResult =
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
        'Accept E2E Full Hangout',
        'Full hangout for accept e2e tests',
        $2,
        1,
        1,
        CURRENT_TIMESTAMP
          + INTERVAL '4 days'
      )
      RETURNING id;
      `,
      [
        hostBId,
        locationId
      ]
    );

  availablePostId =
    availablePostResult
      .rows[0]
      .id;

  secondPostId =
    secondPostResult
      .rows[0]
      .id;

  fullPostId =
    fullPostResult
      .rows[0]
      .id;
}

test.beforeAll(async () => {
  const locationResult =
    await pool.query(
      `
      INSERT INTO sp_locations (
        location_name
      )
      VALUES (
        'Accept E2E Location'
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

  const hostAResult =
    await pool.query(
      `
      INSERT INTO users (
        student_name,
        student_email,
        password_hash
      )
      VALUES (
        'Accept E2E Host A',
        'accept_e2e_host_a@ichat.sp.edu.sg',
        'hashedpassword'
      )
      RETURNING id;
      `
    );

  const hostBResult =
    await pool.query(
      `
      INSERT INTO users (
        student_name,
        student_email,
        password_hash
      )
      VALUES (
        'Accept E2E Host B',
        'accept_e2e_host_b@ichat.sp.edu.sg',
        'hashedpassword'
      )
      RETURNING id;
      `
    );

  const participantResult =
    await pool.query(
      `
      INSERT INTO users (
        student_name,
        student_email,
        password_hash
      )
      VALUES (
        'Accept E2E Participant',
        'accept_e2e_participant@ichat.sp.edu.sg',
        'hashedpassword'
      )
      RETURNING id;
      `
    );

  locationId =
    locationResult.rows[0].id;

  hostAId =
    hostAResult.rows[0].id;

  hostBId =
    hostBResult.rows[0].id;

  participantId =
    participantResult.rows[0].id;
});

test.beforeEach(async () => {
  await resetDatabase();
  await seedPosts();
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
      hostAId,
      hostBId,
      participantId
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
  "Accept Page Load",
  () => {
    test(
      "should display available hangout with Accept button",
      async ({
        page
      }) => {
        await gotoPostPage(
          page,
          {
            userId:
              participantId
          }
        );

        const card =
          getPostCard(
            page,
            "Accept E2E Available Hangout"
          );

        await expect(
          card
        ).toBeVisible();

        await expect(
          card.getByRole(
            "button",
            {
              name: "Accept",
              exact: true
            }
          )
        ).toBeVisible();
      }
    );

    test(
      "should display the post creator name",
      async ({
        page
      }) => {
        await gotoPostPage(
          page,
          {
            userId:
              participantId
          }
        );

        const card =
          getPostCard(
            page,
            "Accept E2E Available Hangout"
          );

        await expect(
          card.locator(
            ".card-author"
          )
        ).toContainText(
          "Accept E2E Host A"
        );
      }
    );

    test(
      "should display the initial participant count",
      async ({
        page
      }) => {
        await gotoPostPage(
          page,
          {
            userId:
              participantId
          }
        );

        const card =
          getPostCard(
            page,
            "Accept E2E Available Hangout"
          );

        await expect(
          card.locator(
            ".participant-count-text"
          )
        ).toContainText(
          /1\s*\/\s*5/
        );
      }
    );

    test(
      "should show Invite Friends instead of Accept for the host",
      async ({
        page
      }) => {
        await gotoPostPage(
          page,
          {
            userId:
              hostAId
          }
        );

        const card =
          getPostCard(
            page,
            "Accept E2E Available Hangout"
          );

        await expect(
          card.getByRole(
            "button",
            {
              name:
                "Invite Friends"
            }
          )
        ).toBeVisible();

        await expect(
          card.getByRole(
            "button",
            {
              name: "Accept",
              exact: true
            }
          )
        ).toHaveCount(0);
      }
    );
  }
);

test.describe(
  "Accept Hangout",
  () => {
    test(
      "should allow a user to accept an available hangout",
      async ({
        page
      }) => {
        await gotoPostPage(
          page,
          {
            userId:
              participantId
          }
        );

        const card =
          getPostCard(
            page,
            "Accept E2E Available Hangout"
          );

        page.once(
          "dialog",
          async (
            dialog
          ) => {
            expect(
              dialog.message()
            ).toMatch(
              /join this hangout/i
            );

            await dialog.accept();
          }
        );

        await card
          .getByRole(
            "button",
            {
              name: "Accept",
              exact: true
            }
          )
          .click();

        await expect(
          card.getByRole(
            "button",
            {
              name: "Unaccept",
              exact: true
            }
          )
        ).toBeVisible();

        await expect(
          card.locator(
            ".participant-count-text"
          )
        ).toContainText(
          /2\s*\/\s*5/
        );

        const dbResult =
          await pool.query(
            `
            SELECT *
            FROM hangout_acceptances
            WHERE post_id = $1
              AND user_id = $2;
            `,
            [
              availablePostId,
              participantId
            ]
          );

        expect(
          dbResult.rows
        ).toHaveLength(1);
      }
    );

    test(
      "should keep accepted state after page reload",
      async ({
        page
      }) => {
        await pool.query(
          `
          INSERT INTO hangout_acceptances (
            post_id,
            user_id
          )
          VALUES (
            $1,
            $2
          );
          `,
          [
            availablePostId,
            participantId
          ]
        );

        await pool.query(
          `
          UPDATE hangout_posts
          SET current_participants = 2
          WHERE id = $1;
          `,
          [
            availablePostId
          ]
        );

        await gotoPostPage(
          page,
          {
            userId:
              participantId
          }
        );

        const card =
          getPostCard(
            page,
            "Accept E2E Available Hangout"
          );

        await expect(
          card.getByRole(
            "button",
            {
              name: "Unaccept",
              exact: true
            }
          )
        ).toBeVisible();

        await expect(
          card.locator(
            ".participant-count-text"
          )
        ).toContainText(
          /2\s*\/\s*5/
        );
      }
    );

    test(
      "should prevent a user from accepting another hangout while one is active",
      async ({
        page
      }) => {
        await pool.query(
          `
          INSERT INTO hangout_acceptances (
            post_id,
            user_id
          )
          VALUES (
            $1,
            $2
          );
          `,
          [
            availablePostId,
            participantId
          ]
        );

        await pool.query(
          `
          UPDATE hangout_posts
          SET current_participants = 2
          WHERE id = $1;
          `,
          [
            availablePostId
          ]
        );

        await gotoPostPage(
          page,
          {
            userId:
              participantId
          }
        );

        const secondCard =
          getPostCard(
            page,
            "Accept E2E Second Hangout"
          );

        page.once(
          "dialog",
          async (
            dialog
          ) => {
            expect(
              dialog.message()
            ).toMatch(
              /already joined another hangout/i
            );

            await dialog.accept();
          }
        );

        await secondCard
          .getByRole(
            "button",
            {
              name: "Accept",
              exact: true
            }
          )
          .click();

        const dbResult =
          await pool.query(
            `
            SELECT *
            FROM hangout_acceptances
            WHERE user_id = $1;
            `,
            [
              participantId
            ]
          );

        expect(
          dbResult.rows
        ).toHaveLength(1);

        expect(
          dbResult.rows[0]
            .post_id
        ).toBe(
          availablePostId
        );
      }
    );

    test(
      "should disable acceptance when a hangout is full",
      async ({
        page
      }) => {
        await gotoPostPage(
          page,
          {
            userId:
              participantId
          }
        );

        const fullCard =
          getPostCard(
            page,
            "Accept E2E Full Hangout"
          );

        const fullButton =
          fullCard.getByRole(
            "button",
            {
              name: "Full",
              exact: true
            }
          );

        await expect(
          fullButton
        ).toBeVisible();

        await expect(
          fullButton
        ).toBeDisabled();

        await expect(
          fullCard.locator(
            ".participant-spots-text"
          )
        ).toContainText(
          /hangout full/i
        );
      }
    );
  }
);

test.describe(
  "Unaccept Hangout",
  () => {
    test(
      "should allow a user to leave an accepted hangout",
      async ({
        page
      }) => {
        await pool.query(
          `
          INSERT INTO hangout_acceptances (
            post_id,
            user_id
          )
          VALUES (
            $1,
            $2
          );
          `,
          [
            availablePostId,
            participantId
          ]
        );

        await pool.query(
          `
          UPDATE hangout_posts
          SET current_participants = 2
          WHERE id = $1;
          `,
          [
            availablePostId
          ]
        );

        await gotoPostPage(
          page,
          {
            userId:
              participantId
          }
        );

        const card =
          getPostCard(
            page,
            "Accept E2E Available Hangout"
          );

        page.once(
          "dialog",
          async (
            dialog
          ) => {
            expect(
              dialog.message()
            ).toMatch(
              /leave this hangout/i
            );

            await dialog.accept();
          }
        );

        await card
          .getByRole(
            "button",
            {
              name: "Unaccept",
              exact: true
            }
          )
          .click();

        await expect(
          card.getByRole(
            "button",
            {
              name: "Accept",
              exact: true
            }
          )
        ).toBeVisible();

        await expect(
          card.locator(
            ".participant-count-text"
          )
        ).toContainText(
          /1\s*\/\s*5/
        );

        const dbResult =
          await pool.query(
            `
            SELECT *
            FROM hangout_acceptances
            WHERE post_id = $1
              AND user_id = $2;
            `,
            [
              availablePostId,
              participantId
            ]
          );

        expect(
          dbResult.rows
        ).toHaveLength(0);
      }
    );

    test(
      "should not leave the hangout when confirmation is cancelled",
      async ({
        page
      }) => {
        await pool.query(
          `
          INSERT INTO hangout_acceptances (
            post_id,
            user_id
          )
          VALUES (
            $1,
            $2
          );
          `,
          [
            availablePostId,
            participantId
          ]
        );

        await pool.query(
          `
          UPDATE hangout_posts
          SET current_participants = 2
          WHERE id = $1;
          `,
          [
            availablePostId
          ]
        );

        await gotoPostPage(
          page,
          {
            userId:
              participantId
          }
        );

        const card =
          getPostCard(
            page,
            "Accept E2E Available Hangout"
          );

        page.once(
          "dialog",
          async (
            dialog
          ) => {
            await dialog.dismiss();
          }
        );

        await card
          .getByRole(
            "button",
            {
              name: "Unaccept",
              exact: true
            }
          )
          .click();

        await expect(
          card.getByRole(
            "button",
            {
              name: "Unaccept",
              exact: true
            }
          )
        ).toBeVisible();

        const dbResult =
          await pool.query(
            `
            SELECT *
            FROM hangout_acceptances
            WHERE post_id = $1
              AND user_id = $2;
            `,
            [
              availablePostId,
              participantId
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
  "Accept API Access Control",
  () => {
    test(
      "should reject POST /accept/:post_id with no auth token",
      async ({
        request
      }) => {
        const response =
          await request.post(
            `${BASE_URL}/accept/${availablePostId}`
          );

        expect(
          response.status()
        ).toBe(401);
      }
    );

    test(
      "should reject DELETE /accept/:post_id with no auth token",
      async ({
        request
      }) => {
        const response =
          await request.delete(
            `${BASE_URL}/accept/${availablePostId}`
          );

        expect(
          response.status()
        ).toBe(401);
      }
    );

    test(
      "should reject the host accepting their own post",
      async ({
        request
      }) => {
        const token =
          createToken(
            hostAId
          );

        const response =
          await request.post(
            `${BASE_URL}/accept/${availablePostId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        expect(
          response.status()
        ).toBe(409);

        const body =
          await response.json();

        expect(
          body.message
        ).toMatch(
          /already counted as the host/i
        );
      }
    );

    test(
      "should return participant details for a post",
      async ({
        request
      }) => {
        const response =
          await request.get(
            `${BASE_URL}/accept/${availablePostId}/participants`
          );

        expect(
          response.status()
        ).toBe(200);

        const body =
          await response.json();

        expect(
          body.post_id
        ).toBe(
          availablePostId
        );

        expect(
          body.current_participants
        ).toBe(1);

        expect(
          body.max_participants
        ).toBe(5);

        expect(
          Array.isArray(
            body.participants
          )
        ).toBe(true);

        expect(
          body.participants
        ).toHaveLength(1);

        expect(
          body.participants[0]
            .is_host
        ).toBe(true);
      }
    );
  }
);