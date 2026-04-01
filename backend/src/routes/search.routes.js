const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { searchUsers } = require('../controllers/search.controller');

const router = Router();

// GET /api/v1/search/users?skill=JavaScript&min_rating=3&limit=20&offset=0
router.get('/users', authenticate, searchUsers);

module.exports = router;
