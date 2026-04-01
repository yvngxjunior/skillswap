const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { getUserReviews } = require('../controllers/reviews.controller');

const router = Router();

// GET /api/v1/users/:userId/reviews
router.get('/:userId/reviews', authenticate, getUserReviews);

module.exports = router;
