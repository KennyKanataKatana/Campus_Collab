const model = require('../models/BlockModel.js');

// READ BLOCKED USERS BY USER ID
module.exports.readBlocksByUserId = (req, res) => {
  const data = {
    user_id: res.locals.userId,
  };

  const callback = (error, results) => {
    if (error) {
      console.error('Error readBlocksByUserId:', error);
      return res.status(500).json(error);
    }

    res.status(200).json(results.rows);
  };

  model.readBlocksByUserId(data, callback);
};

// BLOCK USER
module.exports.blockUser = (req, res) => {
  const data = {
    blocker_id: res.locals.userId,
    blocked_id: req.params.id,
  };

  if (!data.blocked_id) {
    return res.status(400).json({
      message: 'blocked_id is required',
    });
  }

  const callback = (error) => {
    if (error) {
      console.error('Error blockUser:', error);

      if (error.code === '23505') {
        return res.status(409).json({
          message: 'User already blocked',
        });
      }

      if (error.code === '23514') {
        return res.status(400).json({
          message: 'You cannot block yourself',
        });
      }

      return res.status(500).json({
        message: 'Internal server error',
      });
    }

    res.status(201).json({
      message: 'User blocked successfully',
    });
  };

  model.blockUser(data, callback);
};

// UNBLOCK USER
module.exports.unblockUser = (req, res) => {
  const data = {
    blocker_id: res.locals.userId,
    blocked_id: req.params.id,
  };

  const callback = (error, results) => {
    if (error) {
      console.error('Error unblockUser:', error);

      return res.status(500).json({
        message: 'Internal server error',
      });
    }

    if (results.rowCount === 0) {
      return res.status(404).json({
        message: 'Blocked user not found',
      });
    }

    res.status(200).json({
      message: 'User unblocked successfully',
    });
  };

  model.unblockUser(data, callback);
};

// SEARCH USERS
module.exports.searchUsersToBlock = (req, res) => {
  const data = {
    user_id: res.locals.userId,
    search: req.params.name,
  };

  const callback = (error, results) => {
    if (error) {
      console.error('Error searchUsersToBlock:', error);

      return res.status(500).json({
        message: 'Internal server error',
      });
    }

    res.status(200).json(results.rows);
  };

  model.searchUsersToBlock(data, callback);
};