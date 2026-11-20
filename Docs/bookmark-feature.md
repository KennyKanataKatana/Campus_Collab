# Bookmark Feature

## Feature Owner

Ahkar Phyo Min

## Feature Summary

The Bookmark System allows users to save forum posts that they want to revisit later.

The feature allows users to bookmark and remove bookmarks from posts. Users can view their saved posts in a dedicated bookmark page, making it easier to access useful discussions, important information, or posts they are interested in.

The system provides users with a personal collection of saved content without affecting the original post.

## Problem

Campus Collab contains many forum discussions and posts created by users. However, users currently do not have a convenient way to save posts they find useful.

Without a bookmarking feature, users must manually search for posts again, causing unnecessary difficulty when trying to revisit important content.

## Proposed Solution

Add a full-stack Bookmark System.

The system will:

- Allow users to bookmark forum posts
- Allow users to remove bookmarks
- Allow users to view all bookmarked posts
- Prevent duplicate bookmarks
- Store bookmark timestamps
- Display bookmarked posts in a dedicated page
- Allow users to quickly access saved content
- Maintain bookmark ownership between users and posts

---

# User Stories

## US-BM-01: Bookmark a Post

As a logged-in user, I want to bookmark a post so that I can easily find it again later.

## US-BM-02: View Bookmarked Posts

As a logged-in user, I want to view my bookmarked posts so that I can revisit useful discussions.

## US-BM-03: Remove a Bookmark

As a logged-in user, I want to remove a bookmark so that I can manage my saved posts.

## US-BM-04: Manage Saved Content

As a logged-in user, I want to manage my bookmarked posts so that my saved content remains organised.

---

# Acceptance Criteria

## Creating a Bookmark

- The user must be authenticated.
- The post must exist.
- A user cannot bookmark the same post multiple times.
- A successful bookmark creates a bookmark record.
- The bookmarked post appears in the user's bookmark page.

## Viewing Bookmarked Posts

- A user can only view their own bookmarks.
- The bookmark page displays:

  - Post title
  - Post content preview
  - Post creator
  - Location/category information if available
  - Date bookmarked
  - Remove bookmark option

## Removing a Bookmark

- Only the owner of the bookmark can remove it.
- The bookmark record must exist.
- Successful removal deletes the bookmark relationship.
- The post is removed from the bookmark page.

---

# Proposed Database Design

Table name:

`bookmarked_posts`

Fields:

| Field | Type | Description |
|---|---|---|
| id | SERIAL PRIMARY KEY | Unique bookmark ID |
| user_id | INTEGER | User who bookmarked the post |
| post_id | INTEGER | Forum post being bookmarked |
| created_at | TIMESTAMP | Time bookmark was created |

---

# Database Constraints

- Foreign key to `users`
- Foreign key to `forum_posts`
- Duplicate bookmarks are prevented
- User and post relationship must be unique

Example constraint:

```sql
UNIQUE(user_id, post_id)