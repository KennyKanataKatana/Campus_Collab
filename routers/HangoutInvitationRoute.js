const express = require('express');

const router = express.Router();

const hangoutInvitationController = require('../controllers/HangoutInvitationController');

const jwtMiddleware = require('../middlewares/jwtMiddleware');

router.use(jwtMiddleware.verifyToken);

router.post('/', hangoutInvitationController.createInvitation);

router.get('/received', hangoutInvitationController.getReceived);

router.get('/sent', hangoutInvitationController.getSent);

router.get('/invitable/:postId', hangoutInvitationController.getInvitableFriends);

router.patch('/accept/:id', hangoutInvitationController.acceptInvitation);

router.patch('/decline/:id', hangoutInvitationController.declineInvitation);

router.patch('/cancel/:id', hangoutInvitationController.cancelInvitation);

module.exports = router;
