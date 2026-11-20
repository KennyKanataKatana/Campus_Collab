const express = require("express");
const router = express.Router();

// Use the SAME controller file as userRoutes, but a different variable name
const controller = require("../controllers/UserController"); // ← key line
const bcryptMiddleware = require("../middlewares/bcryptMiddleware");
const jwtMiddleware = require("../middlewares/jwtMiddleware");
const middleware = require("../middlewares/response");


// User registration — anyone can sign up here
router.post(
    "/register",
    controller.checkEmailExists,        // Step 1: Validate input + check duplicate email
    bcryptMiddleware.hashPassword,      // Step 2: Hash the password
    controller.register,                // Step 3: Insert user into DB, set userId
    jwtMiddleware.generateToken,        // Step 4: Generate JWT from userId
    middleware.withMessage("User registered successfully!", 201),
    jwtMiddleware.sendToken             // Step 5: Send token + message
);


// User login — anyone can log in here
router.post(
    "/login",
    controller.readUserByEmail,         // Step 1: Find user by email, set hash + userId
    bcryptMiddleware.comparePassword,   // Step 2: Compare input password vs stored hash
    jwtMiddleware.generateToken,        // Step 3: Generate JWT from userId
    middleware.withMessage("User logged in successfully!", 200),
    jwtMiddleware.sendToken             // Step 4: Send token + message
);


module.exports = router;