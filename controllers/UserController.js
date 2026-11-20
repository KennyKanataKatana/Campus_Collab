const model = require("../models/UserModel.js")

module.exports.readAllUsers = (req, res, next) => { 

    const callback = (error, results, fields) => { //Read all existing users
        if (error) {
            //console.error(error); // debug purposes
            return res.status(500).json(error);
        } 

        console.log(results.rows)
        
        return res.status(200).json(results.rows);
    }

    model.readAllUsers(callback);
}

module.exports.readUserById = (req, res, next) => { //Reads one user using the requested ID
    const data = {
        id: req.params.id
    }

    const callback = (error, results, fields) => {
        if (error) {
            console.error(error); // debug purposes
            return res.status(500).json(error); 
        } 

        if(results.length == 0) 
        {
            return res.status(404).json({
                error: "User not found"
            });
        }

        console.log(results)
        
        return res.status(200).json(results.rows[0]);
        
    }

    model.readUserById(data, callback);
}



// REGISTER - Step 1: Check if email already exists
module.exports.checkEmailExists = (req, res, next) => {

    // 400 Check for all expected input
    if (req.body.student_name == undefined ||
        req.body.student_email == undefined ||
        req.body.password == undefined) {
        return res.status(400).json({ message: "Name, email or password is missing." });
    }

    const data = {
        student_email: req.body.student_email
    };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: "Internal server error" });
        }

        else {
            // If results.rows.length > 0, email already taken
            if (results.rows.length > 0) {
                return res.status(409).json({ message: "Email already exists." });
            }
            else next();
        }
    };

    model.checkEmailExists(data, callback);
};


// REGISTER - Step 2: Insert user into DB (password already hashed in res.locals.hash)
module.exports.register = (req, res, next) => {

    // 400 Skipped as we've already done it in checkEmailExists earlier

    // Prepare the data for the model
    // We use hash here, not the raw password
    const data = {
        student_name: req.body.student_name,
        student_email: req.body.student_email,
        password_hash: res.locals.hash, // Encrypted in hashPassword
        bio: "Hello! I'm new to Campus Collab.",
    };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: "Internal server error" });
        }

        else {
            // For sendToken: They send res.locals.message & token
            res.locals.message = `User ${data.student_name} created successfully.`;

            // For generateToken: They save res.locals.userId into token payload
            res.locals.userId = results.rows[0].id;
            res.locals.student_name = results.rows[0].student_name;
            res.locals.student_email = results.rows[0].student_email;
            next();
        }
    };

    model.insertUser(data, callback);
};


// LOGIN - Retrieve user by email for password comparison later
module.exports.readUserByEmail = (req, res, next) => {

    // 400 Check for all expected input
    if (req.body.student_email == undefined ||
        req.body.password == undefined) {
        return res.status(400).json({ message: "Email or password is missing." });
    }

    // We only need email to get the user data first
    const data = {
        student_email: req.body.student_email
    };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: "Internal server error" });
        }

        else {
            // If results.rows.length == 0, that means no such user was found
            if (results.rows.length == 0) {
                console.log(results.rows)
                return res.status(401).json({ message: "Invalid email or password." });
            }

            else {
                // For comparePassword: hashed password is saved into res.locals.hash
                res.locals.hash = results.rows[0].password_hash;

                // For generateToken: Matching userId for input email is saved
                res.locals.userId = results.rows[0].id;
                res.locals.student_name = results.rows[0].student_name;
                res.locals.student_email = results.rows[0].student_email;
                next();
            }
        }
    };

    model.selectUserByEmail(data, callback);
};