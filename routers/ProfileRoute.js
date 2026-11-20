const express = require('express');
const router = express.Router();

const controller = require('../controllers/ProfileController.js');
const jwtMiddleware = require('../middlewares/jwtMiddleware');

router.get('/me', jwtMiddleware.verifyToken, controller.readMyProfile);

module.exports = router;
