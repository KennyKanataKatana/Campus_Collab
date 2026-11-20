const NotificationModel = require('../models/NotificationModel');

async function getNotifications(req, res) {
  try {
    const notifications = await NotificationModel.getNotifications(res.locals.userId);
    return res.json(notifications);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load notifications.' });
  }
}

async function getUnreadCount(req, res) {
  try {
    const count = await NotificationModel.getUnreadCount(res.locals.userId);
    return res.json({ count });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load notification count.' });
  }
}

async function markAsRead(req, res) {
  try {
    const notification = await NotificationModel.markAsRead(
      req.params.id,
      res.locals.userId
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    return res.json(notification);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update notification.' });
  }
}

async function markAllAsRead(req, res) {
  try {
    const updated = await NotificationModel.markAllAsRead(res.locals.userId);
    return res.json({ updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update notifications.' });
  }
}

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
