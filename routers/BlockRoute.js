const express = require('express');
const router = express.Router();

const controller = require('../controllers/BlockController.js');
const jwtMiddleware = require('../middlewares/jwtMiddleware');

router.get('/', jwtMiddleware.verifyToken, controller.readBlocksByUserId);
router.post('/:id', jwtMiddleware.verifyToken, controller.blockUser);
router.delete('/:id', jwtMiddleware.verifyToken, controller.unblockUser);
router.get("/search/:name", jwtMiddleware.verifyToken, controller.searchUsersToBlock);

module.exports = router;