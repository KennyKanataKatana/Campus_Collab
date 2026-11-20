const pool = require('./db')

module.exports.readAllLocations = (callback) => {
    const SQLSTATMENT = `SELECT *
    FROM sp_locations;`;
    pool.query(SQLSTATMENT, callback);
};