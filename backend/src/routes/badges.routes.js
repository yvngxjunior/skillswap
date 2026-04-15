'use strict';

const { Router } = require('express');
const { listBadges } = require('../controllers/badges.controller');

const router = Router();

// Public — no auth required
router.get('/', listBadges);

module.exports = router;
