const HangoutInvitationModel = require('../models/HangoutInvitationModel');

function isPositiveInteger(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

async function createInvitation(req, res) {
  try {
    const senderId = res.locals.userId;

    const { post_id, receiver_id } = req.body;

    if (!isPositiveInteger(post_id) || !isPositiveInteger(receiver_id)) {
      return res.status(400).json({
        error: 'Post ID and receiver ID must be positive integers.',
      });
    }

    if (Number(senderId) === Number(receiver_id)) {
      return res.status(400).json({
        error: 'You cannot invite yourself.',
      });
    }

    const result = await HangoutInvitationModel.createInvitation(post_id, senderId, receiver_id);

    res.status(201).json(result);
  } catch (err) {
    console.error(err);

    if (err.code === '23505') {
      return res.status(409).json({
        error: 'A pending invitation has already been sent to this user.',
      });
    }

    if (err.code === '23503') {
      return res.status(400).json({
        error: 'The selected hangout or user does not exist.',
      });
    }

    if (err.code === '23514') {
      return res.status(400).json({
        error: 'Invalid invitation details.',
      });
    }

    const conflictMessages = [
      'A pending invitation has already been sent to this user.',
      'This friend has already joined the hangout.',
      'This hangout is already full.',
      'This hangout has already started or expired.',
    ];

    if (conflictMessages.includes(err.message)) {
      return res.status(409).json({ error: err.message });
    }

    if (err.message === 'Only the hangout owner can invite friends.') {
      return res.status(403).json({ error: err.message });
    }

    if (
      err.message === 'You can only invite accepted friends.' ||
      err.message === 'You cannot invite yourself.'
    ) {
      return res.status(400).json({ error: err.message });
    }

    if (err.message === 'Hangout not found.') {
      return res.status(404).json({ error: err.message });
    }

    res.status(500).json({
      error: err.message,
    });
  }
}

async function getReceived(req, res) {
  try {
    const userId = res.locals.userId;

    const result = await HangoutInvitationModel.getReceivedInvitations(userId);

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

async function getSent(req, res) {
  try {
    const userId = res.locals.userId;

    const result = await HangoutInvitationModel.getSentInvitations(userId);

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

async function getInvitableFriends(req, res) {
  try {
    const userId = res.locals.userId;

    const postId = req.params.postId;

    if (!isPositiveInteger(postId)) {
      return res.status(400).json({
        error: 'Post ID must be a positive integer.',
      });
    }

    const isOwner = await HangoutInvitationModel.isPostOwner(postId, userId);

    if (!isOwner) {
      return res.status(403).json({
        error: 'Only the hangout owner can view invitable friends.',
      });
    }

    const result = await HangoutInvitationModel.getInvitableFriends(userId, postId);

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

async function acceptInvitation(req, res) {
  try {
    const invitationId = req.params.id;

    if (!isPositiveInteger(invitationId)) {
      return res.status(400).json({
        error: 'Invitation ID must be a positive integer.',
      });
    }

    const receiverId = res.locals.userId;

    const result = await HangoutInvitationModel.acceptInvitation(invitationId, receiverId);

    res.json({
      message: 'Invitation accepted successfully.',
      invitation: result,
    });
  } catch (err) {
    console.error(err);

    if (err.message === 'Invitation not found.') {
      return res.status(404).json({
        error: err.message,
      });
    }

    if (err.message === 'You are not allowed to accept this invitation.') {
      return res.status(403).json({
        error: err.message,
      });
    }

    if (err.message === 'This invitation is no longer pending.') {
      return res.status(409).json({
        error: err.message,
      });
    }

    if (
      err.message === 'This invitation has expired.' ||
      err.message === 'This hangout is already full.'
    ) {
      return res.status(409).json({ error: err.message });
    }

    if (err.message === 'You are already participating in another hangout.') {
      return res.status(409).json({
        error: err.message,
      });
    }

    res.status(500).json({
      error: err.message,
    });
  }
}

async function declineInvitation(req, res) {
  try {
    const invitationId = req.params.id;

    if (!isPositiveInteger(invitationId)) {
      return res.status(400).json({
        error: 'Invitation ID must be a positive integer.',
      });
    }

    const currentUserId = res.locals.userId;

    const invitation = await HangoutInvitationModel.getInvitationById(invitationId);

    if (!invitation) {
      return res.status(404).json({
        error: 'Invitation not found.',
      });
    }

    if (Number(invitation.receiver_id) !== Number(currentUserId)) {
      return res.status(403).json({
        error: 'You are not allowed to decline this invitation.',
      });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(409).json({
        error: 'This invitation is no longer pending.',
      });
    }

    const result = await HangoutInvitationModel.declineInvitation(invitationId, currentUserId);

    if (!result) {
      return res.status(409).json({
        error: 'This invitation is no longer pending.',
      });
    }

    res.json({
      message: 'Invitation declined successfully.',
      invitation: result,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

async function cancelInvitation(req, res) {
  try {
    const invitationId = req.params.id;

    if (!isPositiveInteger(invitationId)) {
      return res.status(400).json({
        error: 'Invitation ID must be a positive integer.',
      });
    }

    const currentUserId = res.locals.userId;

    const invitation = await HangoutInvitationModel.getInvitationById(invitationId);

    if (!invitation) {
      return res.status(404).json({
        error: 'Invitation not found.',
      });
    }

    if (Number(invitation.sender_id) !== Number(currentUserId)) {
      return res.status(403).json({
        error: 'You are not allowed to cancel this invitation.',
      });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(409).json({
        error: 'This invitation is no longer pending.',
      });
    }

    const result = await HangoutInvitationModel.cancelInvitation(invitationId, currentUserId);

    if (!result) {
      return res.status(409).json({
        error: 'This invitation is no longer pending.',
      });
    }

    res.json({
      message: 'Invitation cancelled successfully.',
      invitation: result,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

module.exports = {
  createInvitation,
  getReceived,
  getSent,
  getInvitableFriends,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
};
