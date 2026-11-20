const express = require('express');

const router = express.Router();

const friendsController = require('../controllers/friendsController');

const jwtMiddleware = require('../middlewares/jwtMiddleware');

router.use(jwtMiddleware.verifyToken);

router.post('/request', friendsController.sendRequest);

router.patch('/accept/:id', friendsController.acceptRequest);

router.patch('/reject/:id', friendsController.rejectRequest);

router.get('/pending/:userId', friendsController.getPending);

router.get('/list/:userId', friendsController.getFriends);

router.get('/sent/:userId', friendsController.getSent);

router.get('/search/:name', friendsController.searchUsers);

router.get('/suggestions', friendsController.getSuggestions);

router.delete('/remove/:id', friendsController.removeFriend);

module.exports = router;
