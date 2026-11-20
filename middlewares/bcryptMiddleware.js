//////////////////////////////////////////////////////
// REQUIRE BCRYPT MODULE
//////////////////////////////////////////////////////
const bcrypt = require("bcrypt");

//////////////////////////////////////////////////////
// SET SALT ROUNDS AND PEPPER
//////////////////////////////////////////////////////
const saltRounds = 10;
const pepper = process.env.BCRYPT_PEPPER;

//////////////////////////////////////////////////////
// MIDDLEWARE FUNCTION FOR COMPARING PASSWORD
//////////////////////////////////////////////////////
module.exports.comparePassword = (req, res, next) => {
  // Check password
  const callback = (err, isMatch) => {
    if (err) {
      console.error("Error bcrypt:", err);
      res.status(500).json(err);
    } else {  
      if (isMatch) {
        next();
      } else {
        res.status(401).json({
          message: "Wrong password",
        });
      }
    }
  };
  bcrypt.compare(req.body.password + pepper, res.locals.hash, callback);
};

//////////////////////////////////////////////////////
// MIDDLEWARE FUNCTION FOR HASHING PASSWORD
//////////////////////////////////////////////////////
module.exports.hashPassword = (req, res, next) => {
  const callback = (err, hash) => {
    if (err) {
      console.error("Error bcrypt:", err);
      res.status(500).json(err);
    } else {
      res.locals.hash = hash;
      next();
    }
  };

  bcrypt.hash(req.body.password + pepper, saltRounds, callback);
};
