const model = require("../models/LocationModel.js")

module.exports.readAllLocations = (req, res, next) => { // Read all existing locations

    const callback = (error, results, fields) => {
        if (error) {
            //console.error(error); // debug purposes
            return res.status(500).json(error);
        } 
        
        return res.status(200).json(results.rows);
    }

    model.readAllLocations(callback);
}

