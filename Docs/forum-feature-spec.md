**Module:** Continuous Integration and Continuous Delivery
**COMPONENT:** Forum Feature
**Owner:** Khant Aung Hein
**Status:** Finished

---

## 1. What problem this solves

Campus Collab already has hangouts, friends, and location-based posts, but nowhere for open-ended discussion that isn't tied to a specific event or location. Students need a general space to start a topic, reply to each other, and signal agreement or disagreement — without that space becoming a dumping ground for content from people they've already blocked.

The forum is that space. It's deliberately simple: threads, replies, likes/dislikes, and one hard rule — anything from a blocked user disappears from your view entirely, on both threads and replies.

## 2. Actors and what they're allowed to do

| Actor | Capability |
|---|---|
| Anonymous / logged-out visitor | Can browse threads and read replies; cannot create, reply, vote, or delete |
| Logged-in student | Everything above, plus: create threads, reply, vote, remove their own vote, delete their own threads |
| Thread owner | Can delete their own thread; cannot delete anyone else's, even as a workaround |
| Any student with an active block relationship | Never sees threads or replies authored by users on either side of that block, regardless of sort order or filters applied |

## 3. Functional breakdown

### 3.1 Listing threads (`readAllThreads`)

Threads are always sorted — there is no "unsorted" state. The sort key comes from `req.query.sort` and is validated against a fixed allow-list (`recent`, `likes`, `dislikes`). Anything outside that list — a typo, an injection attempt, an empty string — silently falls back to `recent` rather than erroring. This is intentional: a bad sort parameter should degrade gracefully, not break the page.

After the model returns rows, every thread authored by someone on the caller's block list is filtered out **in the controller**, not the query. This matters for one reason: the block list itself (`res.locals.blockList`) is resolved upstream by middleware before this controller ever runs, keeping the controller ignorant of how blocking is implemented.

### 3.2 Reading a single thread (`readThreadById`)

Works for both logged-in and anonymous callers — `user_id` in the lookup falls back to `null` when there's no session, since a single thread's content isn't sensitive the way a personalized list is. A thread that doesn't exist returns 404 with a plain `{ error: "Thread not found" }`, not a raw empty-array response, so the frontend can distinguish "doesn't exist" from "exists but has no data."

### 3.3 Creating a thread (`createThread`)

Guard order matters here and is checked in this sequence:

1. Authenticated? (`res.locals.userId` must exist)
2. `location_id`, `title`, and `content` all present?
3. If `image_url` was given, is it actually a valid `http`/`https` URL?
4. If `video_url` was given, is it actually a valid `http`/`https` URL?

URL validation is done with a small internal `isValidUrl` helper that wraps the native `URL` constructor in a try/catch — a malformed string throws inside `URL`, which the helper catches and turns into a clean `false` rather than letting an uncaught exception crash the request. Only `http:` and `https:` protocols pass; a `ftp://` or `javascript:` URL is rejected the same way a garbage string is.

Both `image_url` and `video_url` are optional and default to `null` when omitted — they are never left as `undefined` in the data sent to the model, since `undefined` behaves unpredictably across different DB drivers while `null` doesn't.

### 3.4 Replying to a thread (`createReply`)

Same authentication guard as thread creation, then a simpler two-field check: `thread_id` (from the route param) and `content` (from the body) both must be present. No URL fields on replies — replies are text-only by design, keeping moderation and rendering simpler on that surface.

### 3.5 Reading replies (`readRepliesByThreadId`)

Identical block-filtering pattern to thread listing: fetch everything for the thread, then strip out anything from a blocked author before it reaches the response. This is deliberately duplicated logic rather than shared with `readAllThreads`, since the two lists are shaped differently (thread rows vs. reply rows) and a shared abstraction would have added indirection for very little gain.

### 3.6 Deleting a thread (`deleteThread`)

Ownership is not checked with a separate `SELECT` before the `DELETE` — the delete query itself is scoped to `thread_id AND user_id`, and ownership is inferred from `rowCount`. If `rowCount === 0`, either the thread doesn't exist or it exists but belongs to someone else, and the controller responds with 403 either way. This is a deliberate simplification: the caller doesn't need to know *which* of those two things happened, only that the delete didn't go through.

### 3.7 Voting (`voteThread`)

`vote_type` must be exactly `"LIKE"` or `"DISLIKE"` (case-sensitive, no synonyms accepted) — anything else, including a missing value, is a 400. The actual toggle/switch behaviour (voting again removes the vote, switching from like to dislike updates in place) lives in the model layer via `castVote`; the controller doesn't know or care which of those three outcomes happened, it just forwards whatever row comes back.

### 3.8 Removing a vote (`removeVote`)

Separate from voting itself — this exists for the case where a user wants to withdraw their reaction entirely rather than switch it. If there was nothing to remove, the response still comes back as 200 with `removedVote: null` rather than a 404, since "you had no vote to remove" isn't really an error condition from the caller's perspective.

## 4. Data model

**`forum_threads`**

| Column | Notes |
|---|---|
| id | PK |
| user_id | FK → users, author |
| location_id | FK → locations |
| title | required |
| content | required |
| image_url | nullable |
| video_url | nullable |
| like_count / dislike_count | maintained by the voting model, not the controller |
| created_at | |

**`forum_replies`**

| Column | Notes |
|---|---|
| id | PK |
| thread_id | FK → forum_threads |
| user_id | FK → users, author |
| content | required |
| created_at | |

**`forum_votes`**

| Column | Notes |
|---|---|
| thread_id | FK |
| user_id | FK |
| vote_type | `LIKE` or `DISLIKE` |

A unique constraint on `(thread_id, user_id)` is what makes "voting again switches the vote" possible at the model layer — the insert becomes an upsert rather than ever producing duplicate rows.

## 5. Endpoint surface

| Method | Path | Auth required? | Behaviour |
|---|---|---|---|
| GET | `/forum/threads` | optional | List, sorted, block-filtered |
| GET | `/forum/threads/:thread_id` | optional | Single thread, 404 if missing |
| POST | `/forum/threads` | required | Create thread |
| GET | `/forum/threads/:thread_id/replies` | optional | List replies, block-filtered |
| POST | `/forum/threads/:thread_id/replies` | required | Create reply |
| DELETE | `/forum/threads/:thread_id` | required | Owner-only delete |
| POST | `/forum/threads/:thread_id/vote` | required | Like/dislike/switch |
| DELETE | `/forum/threads/:thread_id/vote` | required | Remove vote |

## 6. Coverage strategy

### Unit — controller

Every guard clause and every branch of every conditional gets an isolated test, mocking the model layer entirely:

- **Sort handling:** no `sort` param (defaults to recent), an invalid `sort` value (falls back to recent), a valid non-default value (passed through unchanged).
- **Block filtering:** threads/replies list with at least one blocked author present (confirm exclusion) and with an empty block list (confirm nothing is dropped that shouldn't be).
- **Auth guards:** every write action (`createThread`, `createReply`, `deleteThread`, `voteThread`, `removeVote`) tested once with no `userId` to confirm the 401 fires before the model is ever called.
- **Field validation:** every required-field combination for `createThread` (missing `location_id`, missing `title`, missing `content`) and `createReply` (missing `thread_id`, missing `content`) tested independently, not just as one combined "missing fields" case.
- **URL validation, both fields:** invalid `image_url`, invalid `image_url` with a non-http protocol specifically, invalid `video_url`, and — the branch that's easy to skip — a **valid** `video_url` actually passed all the way through to the model call unmodified. Testing only the rejection path leaves the acceptance path unverified, which is exactly the kind of gap that shows up as a coverage hole later.
- **Vote type validation:** missing `vote_type`, an invalid string value, and both valid values (`LIKE` and `DISLIKE`) each tested at least once through to the model call.
- **Delete ownership:** `rowCount: 0` mapped to 403, `rowCount: 1` mapped to 200 with the deleted row echoed back.
- **Remove-vote both outcomes:** empty `rows` array mapped to `removedVote: null`, non-empty mapped to the actual vote object.
- **DB error path for every function:** each of the eight controller functions gets at least one test where the model's callback is invoked with an error, confirming a 500 and that no partial success response leaks through.

### Unit — model

Thin, one test per function verifying the SQL shape and parameter order reaching `pool.query`, plus the callback reference being passed through untouched. No branching exists at this layer for most functions, so no error-path duplication is needed here — that belongs to the controller tests above.

### Integration

- A logged-in user creates a thread, then that same thread appears in a subsequent list call.
- A second user, blocked by the first, has their threads/replies excluded from what the first user sees, and vice versa.
- Voting twice on the same thread with the same value removes the vote; voting with the opposite value switches it — both proven against a real DB, not mocked model behaviour.
- Attempting to delete a thread as a non-owner is rejected even with a valid, otherwise-authenticated session.

### End-to-end (Playwright)

- Load the forum page and confirm the create-thread form renders.
- Create a thread and see it appear without a page reload.
- Attempt to create a thread while logged out and see the warning, not a silent failure.
- Attempt to create a thread with an invalid image or video URL and see the specific warning message, not a generic one.
- Reply to a thread, and confirm the reply appears attached to the correct thread.
- Vote on a thread, switch the vote, then remove it, confirming the UI count updates at each step.
- Delete a thread as its owner and confirm removal; confirm the delete button does not even render for non-owners.
- Filter by "Your Posts" and "Friends Only" while logged out and see the appropriate warning instead of an empty or broken list.

## 7. Edge cases that deserve their own line item

| Case | Why it's not obvious | Expected behaviour |
|---|---|---|
| `sort` query param present but empty string | `""` is falsy but distinct from `undefined` | Falls back to `recent`, same as an invalid value |
| `video_url` provided but `image_url` omitted | Easy to only test them together | Each field is validated independently; one being absent doesn't skip validation of the other |
| User blocks someone *after* that person already has visible threads | Filtering happens per-request, not at write time | Old threads immediately disappear from the blocker's view on the very next list fetch, no backfill needed |
| Deleting a thread that has replies | No explicit reply-cascade logic shown in the controller | Confirm at the DB layer whether replies cascade-delete or become orphaned — this needs a database constraint, not a controller check |
| Voting on a thread that doesn't exist | Controller doesn't pre-check thread existence before calling `castVote` | Confirm the model/DB layer rejects this via foreign key rather than silently succeeding |

## 8. Definition of done

- All eight controller functions have full branch coverage, including the easy-to-forget "valid input, no error" paths, not just the rejection paths.
- Block-list filtering is proven both ways: something gets removed when it should, and nothing gets removed when the block list is empty.
- Integration tests confirm blocking, voting, and ownership behave correctly against a real database, not just mocked model responses.
- Playwright tests confirm the actual click-through flow for creating, replying to, voting on, and deleting a thread.
- No endpoint returns a raw driver/DB error object to the client on failure.
