const express = require('express');
const router = express.Router();

const controller = require('../controllers/ForumController.js');
const jwtMiddleware = require('../middlewares/jwtMiddleware');
const muteMiddleware = require('../middlewares/muteMiddleware.js');
const blockFilter = require('../middlewares/blockFilter');

router.get('/', jwtMiddleware.verifyToken, blockFilter.filterBlocked, controller.readAllThreads);
router.get('/:thread_id', controller.readThreadById);
router.get('/:thread_id/replies', jwtMiddleware.verifyToken, blockFilter.filterBlocked, controller.readRepliesByThreadId);

router.post('/', jwtMiddleware.verifyToken, muteMiddleware.checkIfMuted, controller.createThread);
router.post('/:thread_id/replies', jwtMiddleware.verifyToken, muteMiddleware.checkIfMuted, controller.createReply);
router.post('/:thread_id/vote', jwtMiddleware.verifyToken, controller.voteThread);
router.delete('/:thread_id/vote', jwtMiddleware.verifyToken, controller.removeVote);
router.delete('/:thread_id', jwtMiddleware.verifyToken, controller.deleteThread);

module.exports = router;