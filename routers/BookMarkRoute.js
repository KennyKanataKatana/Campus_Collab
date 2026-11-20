const express = require('express');
const router = express.Router();

const controller = require('../controllers/BookMarkController.js');
const jwtMiddleware = require('../middlewares/jwtMiddleware');

router.get('/', jwtMiddleware.verifyToken, controller.readBookMarksByUserId);
router.delete('/:post_id', jwtMiddleware.verifyToken, controller.cancelBookMark);

module.exports = router;