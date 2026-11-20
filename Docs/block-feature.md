# User Block Feature

## Feature Owner

Ahkar Phyo Min

## Feature Summary

The User Block System allows users to prevent unwanted interactions from other users.

The feature allows users to block and unblock other users. Blocked users cannot interact with the blocker through supported social features such as viewing content, sending requests, or appearing in user search results depending on system rules.

The system provides users with control over their privacy and helps reduce unwanted communication or interactions.

## Problem

Campus Collab currently allows users to interact with each other through posts, friendships, and other social features. However, users do not have a way to restrict interactions from specific users.

Without a blocking feature, users may continue receiving unwanted interactions, making the platform less comfortable and secure.

## Proposed Solution

Add a full-stack User Block System.

The system will:

- Allow users to block another user
- Allow users to unblock previously blocked users
- Allow users to view their blocked user list
- Allow users to search for users to block
- Prevent users from blocking themselves
- Prevent duplicate block records
- Restrict blocked users from interacting through supported features
- Maintain block timestamps for tracking purposes
- Provide feedback when block actions succeed or fail

## User Stories

### US-BL-01: Block a User

As a logged-in user, I want to block another user so that they cannot interact with me through the platform.

### US-BL-02: View Blocked Users

As a logged-in user, I want to view my blocked users list so that I can manage users I have blocked.

### US-BL-03: Unblock a User

As a logged-in user, I want to unblock a user so that we can interact again.

### US-BL-04: Search Users to Block

As a logged-in user, I want to search for users so that I can easily find someone I want to block.

---

# Acceptance Criteria

## Blocking a User

- The user must be authenticated.
- The target user must exist.
- A user cannot block themselves.
- The same user cannot be blocked multiple times.
- A successful block creates a block relationship.
- The blocked user appears in the blocker’s blocked list.

## Viewing Blocked Users

- A user can only view users they have blocked.
- The blocked list displays:
  - Username
  - Profile information
  - Date blocked
  - Unblock option

## Searching Users

- A user can search existing users.
- The search results exclude:
  - The current user
  - Already blocked users
- Search results return matching users.

## Unblocking a User

- Only the user who created the block can remove it.
- The block relationship must exist.
- A successful unblock removes the block record.
- The user no longer appears in the blocked list.

---

# Proposed Database Design

Table name:

`blocked_users`

Fields:

| Field | Type | Description |
|---|---|---|
| id | SERIAL PRIMARY KEY | Unique block record ID |
| blocker_id | INTEGER | User who created the block |
| blocked_id | INTEGER | User being blocked |
| created_at | TIMESTAMP | Time the block was created |

---

# Database Constraints

- Foreign key to `users` for blocker
- Foreign key to `users` for blocked user
- Blocker and blocked user cannot be the same
- Duplicate block relationships are prevented
- Block records are unique per blocker and blocked user combination

Example constraint:

```sql
UNIQUE(blocker_id, blocked_id)