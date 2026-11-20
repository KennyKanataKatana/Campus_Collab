const model = require('../models/PostHistoryModel.js');

// READ POST HISTORY BY USER ID
module.exports.readPostHistoryByUser = (req, res) => {
  const data = {
    user_id: res.locals.userId,
  };

  const callback = (error, results) => {
    if (error) {
      console.error('Error readPostHistoryByUser:', error);
      return res.status(500).json(error);
    }

    return res.status(200).json(results.rows);
  };

  model.readPostHistoryByUser(data, callback);
};

// DELETE POST HISTORY
module.exports.deletePostHistory = (req, res) => {
  const data = {
    history_id: req.params.history_id,
  };

  const callback = (error, results) => {
    if (error) {
      console.error('Error deletePostHistory:', error);
      return res.status(500).json(error);
    }

    if (results.rowCount === 0) {
      return res.status(404).json({
        error: 'History record not found',
      });
    }

    return res.status(200).json({
      message: 'History deleted successfully',
      deletedHistory: results.rows[0],
    });
  };

  model.deletePostHistory(data, callback);
};