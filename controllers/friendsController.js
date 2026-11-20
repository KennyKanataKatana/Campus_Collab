const friendsModel = require('../models/friendsModel');

function isPositiveInteger(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function isCurrentUser(requestedUserId, currentUserId) {
  return Number(requestedUserId) === Number(currentUserId);
}

async function sendRequest(req, res) {
  try {
    const sender_id = res.locals.userId;

    const { receiver_id } = req.body;

    if (!isPositiveInteger(receiver_id) || Number(sender_id) === Number(receiver_id)) {
      return res.status(400).json({
        error: 'Receiver ID must be a different positive integer.',
      });
    }

    const result = await friendsModel.sendFriendRequest(sender_id, receiver_id);

    res.status(201).json(result);
  } catch (err) {
    console.error(err);

    if (err.message === 'This user is already your friend or has a pending request.') {
      return res.status(409).json({ error: err.message });
    }

    res.status(500).json({
      error: err.message,
    });
  }
}

async function acceptRequest(req, res) {
  try {
    if (!isPositiveInteger(req.params.id)) {
      return res.status(400).json({ error: 'Friend request ID must be a positive integer.' });
    }

    const result = await friendsModel.acceptFriendRequest(req.params.id, res.locals.userId);

    if (!result) {
      return res.status(404).json({ error: 'Pending friend request not found.' });
    }

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

async function rejectRequest(req, res) {
  try {
    if (!isPositiveInteger(req.params.id)) {
      return res.status(400).json({ error: 'Friend request ID must be a positive integer.' });
    }

    const result = await friendsModel.rejectFriendRequest(req.params.id, res.locals.userId);

    if (!result) {
      return res.status(404).json({ error: 'Pending friend request not found.' });
    }

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

async function getPending(req, res) {
  try {
    if (
      !isPositiveInteger(req.params.userId) ||
      !isCurrentUser(req.params.userId, res.locals.userId)
    ) {
      return res.status(403).json({ error: 'You can only view your own pending requests.' });
    }

    const result = await friendsModel.getPendingRequests(req.params.userId);

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

async function getFriends(req, res) {
  try {
    if (
      !isPositiveInteger(req.params.userId) ||
      !isCurrentUser(req.params.userId, res.locals.userId)
    ) {
      return res.status(403).json({ error: 'You can only view your own friends.' });
    }

    const result = await friendsModel.getFriendsList(req.params.userId);

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
    if (
      !isPositiveInteger(req.params.userId) ||
      !isCurrentUser(req.params.userId, res.locals.userId)
    ) {
      return res.status(403).json({ error: 'You can only view your own sent requests.' });
    }

    const result = await friendsModel.getSentRequests(req.params.userId);

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

async function searchUsers(req, res) {
  try {
    const users = await friendsModel.searchUsers(req.params.name);

    res.json(users);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

async function getSuggestions(req, res) {
  try {
    const users = await friendsModel.getSuggestedFriends(res.locals.userId);

    res.json(users);
  } catch (err) {
    console.error(err);

    res.status(500).json(err);
  }
}

async function removeFriend(req, res) {
  try {
    if (!isPositiveInteger(req.params.id)) {
      return res.status(400).json({ error: 'Friend request ID must be a positive integer.' });
    }

    const result = await friendsModel.removeFriend(req.params.id, res.locals.userId);

    if (!result) {
      return res.status(404).json({ error: 'Friend relationship not found.' });
    }

    res.json({
      message: 'Friend removed',
    });
  } catch (err) {
    console.error(err);

    res.status(500).json(err);
  }
}

async function getProfile(req, res) {
  try {
    const profileUserId = req.params.id;
    const currentUserId = res.locals.userId;

    const mutualCount = await friendsModel.getMutualFriendCount(currentUserId, profileUserId);

    res.json({
      mutual_count: mutualCount,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

module.exports = {
  sendRequest,
  acceptRequest,
  rejectRequest,
  getProfile,
  getPending,
  getFriends,
  getSent,
  searchUsers,
  getSuggestions,
  removeFriend,
};
