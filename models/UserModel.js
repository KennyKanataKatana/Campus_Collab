const pool = require('./db')

module.exports.readAllUsers = (callback) => {
    const SQLSTATMENT = `SELECT *
    FROM users;`;
    pool.query(SQLSTATMENT, callback);
};

module.exports.readUserById = (data, callback) => {
    const SQLSTATMENT = `SELECT
    id,
    student_name,
    student_email,
    bio
    FROM users
    WHERE id = $1;`;

    const VALUE = [data.id];

    pool.query(SQLSTATMENT, VALUE, callback);
};

module.exports.insertUser = (data, callback) => {
    const SQLSTATEMENT = `
        INSERT INTO users (student_name, student_email, password_hash, bio)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
    `;
    const VALUES = [data.student_name, data.student_email, data.password_hash, data.bio];

    pool.query(SQLSTATEMENT, VALUES, callback);
};


module.exports.selectUserByEmail = (data, callback) => {
    const SQLSTATEMENT = `
        SELECT id, student_name, student_email, password_hash
        FROM users
        WHERE student_email = $1;
    `;
    const VALUES = [data.student_email];

    pool.query(SQLSTATEMENT, VALUES, callback);
};


module.exports.checkEmailExists = (data, callback) => {
    const SQLSTATEMENT = `
        SELECT id
        FROM users
        WHERE student_email = $1;
    `;
    const VALUES = [data.student_email];

    pool.query(SQLSTATEMENT, VALUES, callback);
};