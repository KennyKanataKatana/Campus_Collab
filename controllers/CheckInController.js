const model = require('../models/CheckInModel');

function getPostId(req, res) {
  const postId = Number(req.params.post_id);

  if (!Number.isInteger(postId) || postId <= 0) {
    res.status(400).json({ message: 'A valid post ID is required.' });
    return null;
  }

  return postId;
}

module.exports.createCheckIn = (req, res) => {
  const postId = getPostId(req, res);

  if (postId === null) return;

  const data = {
    post_id: postId,
    user_id: res.locals.userId,
  };

  model.getEligibility(data, (eligibilityError, eligibilityResult) => {
    if (eligibilityError) {
      console.error('Check-in eligibility error:', eligibilityError);
      return res.status(500).json({ message: 'Internal server error.' });
    }

    const status = eligibilityResult.rows[0].status;

    if (status === 'POST_NOT_FOUND') {
      return res.status(404).json({ message: 'Hangout post not found.' });
    }

    if (status === 'NOT_ACCEPTED') {
      return res.status(403).json({
        message: 'You can only check in to a hangout you have accepted.',
      });
    }

    if (status === 'ALREADY_CHECKED_IN') {
      return res.status(409).json({ message: 'You have already checked in.' });
    }

    model.insertSingle(data, (insertError, insertResult) => {
      if (insertError) {
        if (insertError.code === '23505') {
          return res.status(409).json({
            message: 'You have already checked in.',
          });
        }

        console.error('Create check-in error:', insertError);
        return res.status(500).json({ message: 'Internal server error.' });
      }

      return res.status(201).json({
        message: 'Checked in successfully.',
        check_in: insertResult.rows[0],
      });
    });
  });
};

module.exports.readMyCheckIns = (req, res) => {
  model.selectByUserId(res.locals.userId, (error, results) => {
    if (error) {
      console.error('Read check-ins error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }

    return res.status(200).json(results.rows);
  });
};

module.exports.readEligibleHangouts = (req, res) => {
  model.selectEligibleByUserId(res.locals.userId, (error, results) => {
    if (error) {
      console.error('Read eligible hangouts error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }

    return res.status(200).json(results.rows);
  });
};

module.exports.deleteCheckIn = (req, res) => {
  const postId = getPostId(req, res);

  if (postId === null) return;

  const data = {
    post_id: postId,
    user_id: res.locals.userId,
  };

  model.deleteSingle(data, (error, results) => {
    if (error) {
      console.error('Delete check-in error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }

    if (results.rowCount === 0) {
      return res.status(404).json({ message: 'Check-in not found.' });
    }

    return res.status(200).json({
      message: 'Check-in removed successfully.',
      deleted_check_in: results.rows[0],
    });
  });
};
