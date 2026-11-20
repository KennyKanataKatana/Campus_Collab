const model = require('../models/BlockModel.js');

module.exports.filterBlocked = (req, res, next) => {
  const data = {
    user_id: res.locals.userId,
  };

  const callback = (error, results) => {
    if (error) {
      console.error('Error readBlocksByUserId:', error);
      return res.status(500).json(error);
    }

    // Store block list for the next controller
    res.locals.blockList = [];

    for (let i = 0; i < results.rows.length; i++) {
      res.locals.blockList.push(results.rows[i].blocked_id);
    }

    // Continue to the next middleware/controller
    next();
  };

  model.readBlocksByUserId(data, callback);
};