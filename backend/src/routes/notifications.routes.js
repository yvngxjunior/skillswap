'use strict';

const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const {
  listNotifications,
  markRead,
  markAllRead,
  registerPushToken,
} = require('../controllers/notifications.controller');

const router = Router();

// All notification routes require a valid JWT
router.use(authenticate);

// GET  /api/v1/notifications              — paginated list + unread count
router.get('/',                        listNotifications);

// PATCH /api/v1/notifications/read-all   — mark all as read (must be before :id route)
router.patch('/read-all',              markAllRead);

// PATCH /api/v1/notifications/:id/read   — mark single as read
router.patch('/:notificationId/read',  markRead);

// POST  /api/v1/notifications/push-token — register Expo push token
router.post('/push-token',             registerPushToken);

module.exports = router;
