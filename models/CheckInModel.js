const pool = require('./db');

module.exports.getEligibility = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM hangout_posts WHERE id = $1
      ) THEN 'POST_NOT_FOUND'
      WHEN NOT EXISTS (
        SELECT 1
        FROM hangout_acceptances
        WHERE post_id = $1 AND user_id = $2
      ) THEN 'NOT_ACCEPTED'
      WHEN EXISTS (
        SELECT 1
        FROM hangout_check_ins
        WHERE post_id = $1 AND user_id = $2
      ) THEN 'ALREADY_CHECKED_IN'
      ELSE 'ELIGIBLE'
    END AS status;
  `;

  pool.query(SQLSTATEMENT, [data.post_id, data.user_id], callback);
};

module.exports.insertSingle = (data, callback) => {
  const SQLSTATEMENT = `
    INSERT INTO hangout_check_ins (post_id, user_id)
    VALUES ($1, $2)
    RETURNING id, post_id, user_id, checked_in_at;
  `;

  pool.query(SQLSTATEMENT, [data.post_id, data.user_id], callback);
};

module.exports.selectByUserId = (userId, callback) => {
  const SQLSTATEMENT = `
    SELECT
      hci.id,
      hci.post_id,
      hci.user_id,
      hci.checked_in_at,
      hp.title,
      hp.description,
      hp.current_participants,
      hp.max_participants,
      host.student_name AS host_name,
      location.location_name
    FROM hangout_check_ins hci
    INNER JOIN hangout_posts hp ON hp.id = hci.post_id
    INNER JOIN users host ON host.id = hp.user_id
    INNER JOIN sp_locations location ON location.id = hp.location_id
    WHERE hci.user_id = $1
    ORDER BY hci.checked_in_at DESC;
  `;

  pool.query(SQLSTATEMENT, [userId], callback);
};

module.exports.selectEligibleByUserId = (userId, callback) => {
  const SQLSTATEMENT = `
    SELECT
      hp.id AS post_id,
      hp.title,
      hp.description,
      hp.current_participants,
      hp.max_participants,
      ha.accepted_at,
      host.student_name AS host_name,
      location.location_name
    FROM hangout_acceptances ha
    INNER JOIN hangout_posts hp ON hp.id = ha.post_id
    INNER JOIN users host ON host.id = hp.user_id
    INNER JOIN sp_locations location ON location.id = hp.location_id
    LEFT JOIN hangout_check_ins hci
      ON hci.post_id = ha.post_id AND hci.user_id = ha.user_id
    WHERE ha.user_id = $1 AND hci.id IS NULL
    ORDER BY ha.accepted_at DESC;
  `;

  pool.query(SQLSTATEMENT, [userId], callback);
};

module.exports.deleteSingle = (data, callback) => {
  const SQLSTATEMENT = `
    DELETE FROM hangout_check_ins
    WHERE post_id = $1 AND user_id = $2
    RETURNING id, post_id, user_id, checked_in_at;
  `;

  pool.query(SQLSTATEMENT, [data.post_id, data.user_id], callback);
};
