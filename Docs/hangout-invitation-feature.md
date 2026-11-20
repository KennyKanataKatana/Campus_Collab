# Hangout Invitation Feature

## Feature Owner

Seung Un Lim

## Feature Summary

The Hangout Invitation System allows users to invite existing friends to join their hangout posts.

The feature connects the existing Friend System with the Hangout System. Invitations can be sent, viewed, accepted or declined. When an invitation is accepted, the invited user is added as a participant in the hangout.

## Problem

Campus Collab currently allows users to create hangouts and manage friendships, but there is no direct way for a user to invite a friend to a specific hangout.

Users must rely on their friends discovering the hangout manually. This creates unnecessary friction and reduces interaction between the Friend and Hangout features.

## Proposed Solution

Add a full-stack Hangout Invitation System.

The system will:

- Allow a hangout creator to view eligible friends
- Allow the creator to invite a friend
- Prevent duplicate invitations
- Allow users to view received invitations
- Allow invitations to be accepted or declined
- Add the invited user to the hangout after acceptance
- Reject acceptance if the hangout is already full
- Record invitation status and timestamps
- Expire invitations after seven days or when the hangout starts
- Prevent self, non-friend, duplicate, joined-user, full, and expired-hangout invitations
- Notify users about invitations, responses, cancellations, expiration, and upcoming hangouts

## User Stories

### US-HI-01: Send Hangout Invitation

As a logged-in user, I want to invite one of my friends to my hangout so that we can participate together.

### US-HI-02: View Received Invitations

As a logged-in user, I want to view the hangout invitations I have received so that I can decide whether to join.

### US-HI-03: Respond to Invitation

As an invited user, I want to accept or decline a hangout invitation so that I can manage my participation.

### US-HI-04: View Sent Invitations

As a hangout creator, I want to view the status of invitations I sent so that I know who has responded.

## Acceptance Criteria

### Sending an Invitation

- The user must be authenticated.
- The hangout must exist.
- The sender must be the creator of the hangout.
- The invited user must be an accepted friend of the sender.
- A user cannot invite themselves.
- The invited user must not already be a participant.
- A duplicate pending invitation must not be created.
- A successful invitation returns an appropriate success response.

### Viewing Invitations

- A user can only view invitations sent to them.
- A sender can only view invitations they created.
- Invitation information includes:
  - Hangout title
  - Sender name
  - Invitee name
  - Invitation status
  - Date created

### Accepting an Invitation

- Only the invited user can accept the invitation.
- Only pending invitations can be accepted.
- The hangout must still exist.
- The hangout must have available capacity.
- The invited user must not already be a participant.
- Acceptance adds the user to the hangout participation table.
- Invitation status changes to ACCEPTED.

### Declining an Invitation

- Only the invited user can decline the invitation.
- Only pending invitations can be declined.
- Invitation status changes to DECLINED.
- Declining does not add the user to the hangout.

## Proposed Database Design

Table name:

`hangout_invitations`

Fields:

| Field | Type | Description |
|---|---|---|
| id | SERIAL PRIMARY KEY | Unique invitation ID |
| hangout_post_id | INTEGER | Invited hangout |
| sender_id | INTEGER | User sending the invitation |
| receiver_id | INTEGER | User receiving the invitation |
| status | VARCHAR | PENDING, ACCEPTED or DECLINED |
| created_at | TIMESTAMP | Invitation creation time |
| responded_at | TIMESTAMP | Time accepted or declined |
| expires_at | TIMESTAMP | Earlier of seven days after creation or the hangout time |

Notifications are stored in the `notifications` table with an unread/read timestamp and a unique deduplication key. Reminder notifications are generated once when a joined hangout is within 24 hours.

## Database Upgrade

Existing development databases can be upgraded without resetting data:

```sh
npm run migration:invitations
```

## Proposed Database Constraints

- Foreign key to `hangout_posts`
- Foreign key to `users` for sender
- Foreign key to `users` for receiver
- Sender and receiver cannot be the same
- Status must be PENDING, ACCEPTED or DECLINED
- Duplicate invitations for the same hangout and receiver are prevented

## Proposed Backend Structure

### Model

Possible file:

`src/models/hangoutInvitationModel.js`

Functions:

- createInvitation
- getInvitationById
- getReceivedInvitations
- getSentInvitations
- acceptInvitation
- declineInvitation
- checkExistingInvitation
- getEligibleFriends

### Controller

Possible file:

`src/controllers/hangoutInvitationController.js`

Functions:

- sendInvitation
- listReceivedInvitations
- listSentInvitations
- acceptInvitation
- declineInvitation
- listEligibleFriends

### Routes

Possible file:

`src/routes/hangoutInvitationRoutes.js`

Endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /hangout-invitations/received | View received invitations |
| GET | /hangout-invitations/sent | View sent invitations |
| GET | /hangout-invitations/eligible/:hangoutId | View eligible friends |
| POST | /hangout-invitations | Send invitation |
| PATCH | /hangout-invitations/:id/accept | Accept invitation |
| PATCH | /hangout-invitations/:id/decline | Decline invitation |

## Proposed Frontend Changes

### Hangout Page

Add an `Invite Friend` button to hangouts created by the logged-in user.

When clicked:

- Open a modal
- Load eligible friends
- Show friend names
- Allow the user to send an invitation
- Display success or error feedback

### Invitations Page or Modal

Display:

- Received invitations
- Sent invitations
- Invitation status
- Accept button
- Decline button

## Testing Plan

### Unit and Model Tests

- Successfully create an invitation
- Reject a self-invitation
- Reject a duplicate invitation
- Reject invitation to a non-friend
- Retrieve received invitations
- Retrieve sent invitations
- Accept a pending invitation
- Decline a pending invitation
- Reject response to an already-processed invitation
- Reject acceptance when the hangout is full

### Integration Tests

- Authenticated user sends valid invitation
- Unauthenticated request is rejected
- Non-owner cannot invite users to another person's hangout
- Receiver accepts invitation
- Receiver declines invitation
- Incorrect user cannot respond to invitation

### Playwright Tests

- Hangout owner opens the invitation modal and invites a friend
- Invited friend logs in and accepts the invitation
- Invited friend declines an invitation
- Duplicate invitation displays an error
- Full hangout cannot be accepted

## Definition of Done

The feature is complete when:

- Database schema is implemented
- Backend model, controller and routes are implemented
- Frontend invitation interface is implemented
- Authentication and authorisation are enforced
- Validation rules are implemented
- Unit and integration tests pass
- Playwright tests pass
- CI pipeline passes
- Code is reviewed through a pull request
- Feature documentation is updated

## Risks

| Risk | Mitigation |
|---|---|
| Duplicate invitations | Add database uniqueness and backend validation |
| Non-friends being invited | Verify accepted friendship before insertion |
| Full hangouts being accepted | Recheck capacity during acceptance |
| Unauthorized invitation responses | Compare logged-in user ID with receiver ID |
| Merge conflicts | Keep feature files separated and pull main regularly |
| Low branch coverage | Add tests for each rejection and error condition |
