**Module:** Continuous Integration and Continuous Delivery
**COMPONENT:** Report Feature
**Owner:** Khant Aung Hein
**Status:** Finished and Finalized

---

## 1. Why this module exists

Campus Collab needs a way for students to flag bad behaviour and for moderators to act on it without exposing raw moderation data to every user. Two things had to exist together, because one is meaningless without the other:

- A **reporting channel**, so misconduct gets recorded with evidence and context.
- An **appeal channel**, so a punished user has a route back instead of just being muted with no recourse.

Building them separately would have meant duplicating auth checks, passkey gating, and DB error handling twice. Instead they share the same access-control pattern and sit behind the same admin surface.

## 2. Who touches this module

| Role | Can do |
|---|---|
| Any logged-in student | Submit a report against another student; submit an appeal (general or tied to a specific report they were involved in) |
| Muted student | Blocked from submitting new reports until the mute expires |
| Moderator / admin | Unlock the reports and appeals panels with a shared passkey; view, filter, mute, and unmute |
| Unauthenticated visitor | Cannot submit anything; cannot read anything without both a valid JWT (for personal endpoints) and/or the moderation passkey (for admin endpoints) |

## 3. Story map

**As a student who was harassed in a hangout thread**, I want to file a report with a reason and optional proof image, so the incident is on record and a moderator can review it.

**As a student who thinks a report against me is unfair**, I want to submit an appeal — either linked to the exact report or as a general appeal if I'm not sure which report caused my mute — so a moderator can reconsider.

**As a moderator**, I want the reports/appeals lists hidden behind a passkey rather than open to any logged-in user, so casual users can't browse other people's moderation history.

**As a moderator**, I want to mute a reported user for a set number of minutes and unmute them early if needed, so enforcement doesn't require touching the database directly.

**As a muted student**, I should be prevented from submitting further reports while muted, so the mute actually restricts behaviour rather than just being cosmetic.

## 4. Rules that must always hold

### Submitting a report
- Caller must be authenticated (JWT required).
- `reported_user`, `reason`, and the rules-acknowledgement checkbox are required; proof image URL is optional.
- A user cannot report themselves — validated by comparing the reporter's ID to the resolved reported-user ID before insert.
- The reported username must resolve to a real user, otherwise the request is rejected before hitting the reports table.

### Reading reports
- List endpoints require the `x-report-passkey` header to match the configured moderation passkey; missing or wrong passkey returns a rejection before any query runs.
- Reports can be filtered by `reporter_id` or by `reported_user_id` via query parameters.
- A student can retrieve *their own* received reports through a JWT-authenticated endpoint that does not require the moderation passkey, since they're only seeing reports made against themselves.

### Muting / unmuting
- Mute requires the passkey header, a target user, and a mute duration in minutes; a non-numeric or non-positive duration is rejected.
- Unmute requires the same passkey and clears the mute regardless of remaining time.
- A muted user attempting to submit a report is rejected at the middleware layer before the controller even runs — this is enforced separately from the mute record's existence, so expired mutes don't block anyone.

### Submitting an appeal
- Caller must be authenticated; `res.locals.userId` must be present or the request is rejected before any DB call.
- `reason` is required and cannot be empty or whitespace-only.
- `report_id` is optional — omitting it produces a general appeal not tied to any specific incident.
- If a `report_id` is supplied but doesn't correspond to a real report, the insert fails on the foreign-key constraint and the caller receives a "related report not found" response rather than a generic server error.

### Reading appeals
- Same passkey-gated admin list pattern as reports — no partial exposure of appeal contents to non-admins.

## 5. Data shape

**`reports`**

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| reporter_id | INTEGER | FK → users, who filed it |
| reported_user_id | INTEGER | FK → users, who it's against |
| reason | TEXT | required |
| proof_image_url | TEXT | nullable |
| created_at | TIMESTAMP | default now |

**`appeals`**

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| user_id | INTEGER | FK → users, who is appealing |
| report_id | INTEGER, nullable | FK → reports, ON DELETE behaviour must not orphan the appeal silently — violation surfaces as Postgres error code `23503` |
| reason | TEXT | required, trimmed non-empty |
| status | VARCHAR | e.g. PENDING / REVIEWED |
| created_at | TIMESTAMP | default now |

A mute state (whether tracked on the `users` table directly via a `muted_until` column, or a separate table) records who is currently muted and until when, so the mute-restriction middleware has something to check against on every report-submission attempt.

## 6. Surface area

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/reports` | JWT | Create report; rejects self-report |
| GET | `/reports` | passkey | Full list, optional `reporter_id` / `reported_user_id` filters |
| GET | `/reports/my-received-reports` | JWT | Caller's own received reports only |
| PATCH | `/reports/mute/:userId` | passkey | Mute a user for N minutes |
| PATCH | `/reports/unmute/:userId` | passkey | Clear a mute early |
| POST | `/appeals` | JWT | Create appeal, general or report-linked |
| GET | `/appeals` | passkey | Full list |

## 7. Failure modes worth naming explicitly

- **Passkey missing vs. passkey wrong** are distinct failure paths and both must be rejected identically from the caller's point of view (no information leak about which passkeys are "close").
- **Reporting a nonexistent username** must fail before an insert is attempted, not rely on a foreign-key error to catch it, since the error message needs to be user-facing ("that student doesn't exist") rather than a raw DB error.
- **Appeal to a deleted/nonexistent report** must map Postgres FK violation (`23503`) to a specific "related report not found" response — a generic 500 here is misleading, since the request itself was well-formed.
- **Mute with invalid duration** (zero, negative, non-numeric) must be caught client-side and server-side, since a bad mute duration is a silent no-op that looks successful.

## 8. Coverage plan

**Model layer** — pure SQL-building functions with no branching; one test per function asserting the query shape, parameter array, and callback pass-through is sufficient. No error-path tests needed here since the model doesn't interpret errors, it just forwards them.

**Controller layer** — every guard clause gets its own test:
- auth missing → 401
- required-field missing (including whitespace-only reason) → 400
- self-report attempt → 400/409
- nonexistent reported user → 404
- passkey missing → 401/403
- passkey wrong → 401/403
- FK violation on appeal creation (`error.code === '23503'`) → 404 with the specific message, not a generic 500
- any other DB error → 500
- success path → correct status + payload shape, both with and without optional fields (proof image, report_id)

**Integration layer** — this is where auth boundaries actually get proven, since unit tests mock the JWT/passkey middleware away. Minimum set:
- reject POST with no auth token
- reject GET with no passkey header
- reject GET with wrong passkey header
- reject mute/unmute PATCH with no passkey header
- muted user blocked from submitting a report
- unauthenticated user blocked from submitting a report
- filtered list results actually match the filter (reporter id, reported user id)
- a reporter with zero reports after their reports are cleaned up gets a 404, not an empty 200 — these are semantically different and both should be checked

**End-to-end (Playwright)** — cover the human-facing flow, not just the API:
- submit report with and without proof image
- rules checkbox blocks submission until checked
- reported username that doesn't exist shows a warning, not a silent failure
- unlock reports/appeals panel with correct and incorrect passkey
- show-passkey checkbox actually toggles input visibility
- mute a reported user and confirm the mute reflects in the UI
- cancel the mute/unmute confirmation dialog and confirm nothing changed
- submit a report-linked appeal and a general appeal separately

## 9. Known sharp edges

| Risk | Why it's easy to miss | How it's handled |
|---|---|---|
| Passkey sent as a query param instead of header by a future frontend change | Header-only checks silently pass through if someone "helpfully" also checks query params later | Only the header is trusted; document this loudly in the middleware itself |
| Mute duration input accepting decimals or huge numbers | Client-side validation alone isn't enough | Server revalidates duration type and bounds before writing |
| Appeal `report_id` referencing a report that gets deleted between validation and insert (race condition) | Rare but possible under concurrent moderation actions | Rely on the DB foreign-key constraint as the final authority, not a pre-check that can go stale |
| Confusing "no reports found" (200, empty array) with "reporter doesn't exist" (404) | Both look like "nothing here" from the frontend | Keep these as distinct response codes so the frontend can message them differently |

## 10. Done means

- Report and appeal tables exist with the constraints above.
- All controller guard clauses have unit tests, all failing before the fix and passing after.
- Integration tests prove the passkey and JWT boundaries can't be bypassed.
- Playwright tests confirm the actual moderator workflow (unlock → view → mute/unmute) works end to end.
- No endpoint returns a raw driver/DB error object to the client — every error path is mapped to a deliberate message.
