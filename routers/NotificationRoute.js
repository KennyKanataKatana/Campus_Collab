const express = require('express');
const controller = require('../controllers/NotificationController');
const jwtMiddleware = require('../middlewares/jwtMiddleware');

const router = express.Router();

router.use(jwtMiddleware.verifyToken);
router.get('/', controller.getNotifications);
router.get('/unread-count', controller.getUnreadCount);
router.patch('/read-all', controller.markAllAsRead);
router.patch('/:id/read', controller.markAsRead);

module.exports = router;
