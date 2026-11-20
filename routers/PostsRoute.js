const express = require('express');
const router = express.Router();

const controller = require('../controllers/PostsController.js');
const jwtMiddleware = require('../middlewares/jwtMiddleware');
const blockFilter = require('../middlewares/blockFilter');
const muteMiddleware = require('../middlewares/muteMiddleware.js');

router.get('/', jwtMiddleware.verifyToken, blockFilter.filterBlocked, controller.readAllPosts);
router.get('/bookmark', jwtMiddleware.verifyToken, controller.readBookMarksByUserId);
router.post('/', jwtMiddleware.verifyToken, muteMiddleware.checkIfMuted, controller.uploadPost);
router.post('/:post_id', jwtMiddleware.verifyToken, controller.bookMarkPost);
router.delete('/:post_id', jwtMiddleware.verifyToken, controller.deletePost);

module.exports = router;
