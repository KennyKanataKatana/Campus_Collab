const model = require('../models/BookMarkModel.js');

// READ BOOKMARKS BY USER ID
module.exports.readBookMarksByUserId = (req, res) => {
  const data = {
    user_id: res.locals.userId,
  };

  const callback = (error, results) => {
    if (error) {
      console.error('Error readBookMarksByUserId:', error);
      return res.status(500).json(error);
    }

    res.status(200).json(results.rows);
  };

  model.readBookMarksByUserId(data, callback);
};

// CANCEL BOOKMARK
module.exports.cancelBookMark = (req, res) => {
  const data = {
    post_id: req.params.post_id,
    user_id: res.locals.userId,
  };

  const callback = (error, results) => {
    if (error) {
      console.error('Error cancelBookMark:', error);
      return res.status(500).json(error);
    }

    if (results.rowCount === 0) {
      return res.status(404).json({
        message: 'Bookmark not found',
      });
    }

    res.status(200).json({
      message: 'Bookmark deleted successfully',
    });
  };

  model.cancelBookMark(data, callback);
};