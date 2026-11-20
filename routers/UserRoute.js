const express = require('express');
const router = express.Router();

const controller = require('../controllers/UserController.js');
const jwtMiddleware = require('../middlewares/jwtMiddleware');


// GET /users - Protected: Get all users (need valid token)
router.get('/', jwtMiddleware.verifyToken, controller.readAllUsers);

// GET /users/:id - Protected: Get user by ID (need valid token)
router.get('/:id', jwtMiddleware.verifyToken, controller.readUserById);


module.exports = router;