# Post History Feature

## Feature Owner

Ahkar Phyo Min

## Feature Summary

The Post History System allows users to view a record of forum posts they have previously created.

The feature automatically records user-created posts and displays them in a dedicated history page. Users can use this page to review their previous discussions, manage their content, and quickly access older posts.

The system provides users with a personal activity record while keeping post ownership and visibility controlled.

## Problem

Campus Collab allows users to create forum posts, but there is currently no dedicated way for users to view all posts they have created in one place.

Without a post history feature, users must manually search through the forum to locate their previous posts. This makes managing and reviewing their contributions more difficult.

## Proposed Solution

Add a full-stack Post History System.

The system will:

- Automatically record posts created by users
- Allow users to view their previous posts
- Display post details and creation timestamps
- Provide quick access to past discussions
- Ensure users can only view their own post history
- Maintain a history record even when posts are no longer displayed in the main feed
- Allow users to manage and review their previous contributions

---

# User Stories

## US-PH-01: View Post History

As a logged-in user, I want to view my previous posts so that I can review my past contributions.

## US-PH-02: Access Previous Posts

As a logged-in user, I want to access my old posts so that I can revisit discussions I created.

## US-PH-03: Track Created Content

As a logged-in user, I want the system to record my created posts so that I have a history of my activity.

## US-PH-04: Manage Post Records

As a logged-in user, I want to view my post records so that I can keep track of my contributions.

---

# Acceptance Criteria

## Recording Post History

- The user must be authenticated when creating a post.
- A history record is created when a post is successfully created.
- The history record stores the user and post relationship.
- Duplicate history records are prevented.

## Viewing Post History

- A user can only view their own post history.
- The history page displays:

  - Post title
  - Post content preview
  - Post category/location information if available
  - Post creation date
  - History record date
  - View post option

## Removing Post History

- Only the owner can remove their history record.
- The history record must exist.
- Successful removal deletes the history entry.
- Removing history does not delete the original post unless explicitly supported.

---

# Proposed Database Design

Table name:

`post_history`

Fields:

| Field | Type | Description |
|---|---|---|
| id | SERIAL PRIMARY KEY | Unique history record ID |
| user_id | INTEGER | User who created the post |
| post_id | INTEGER | Referenced forum post |
| viewed_at | TIMESTAMP | Time the post was added to history |

---

# Database Constraints

- Foreign key to `users`
- Foreign key to `forum_posts`
- Duplicate history records are prevented
- History belongs to the user who created the post

Example constraint:

```sql
UNIQUE(user_id, post_id)