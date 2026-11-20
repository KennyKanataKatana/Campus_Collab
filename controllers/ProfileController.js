const model = require('../models/ProfileModel.js');

module.exports.readMyProfile = (req, res) => {
  const data = {
    user_id: res.locals.userId,
  };

  const callback = (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    if (results.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    return res.status(200).json(results.rows[0]);
  };

  model.readMyProfile(data, callback);
};
