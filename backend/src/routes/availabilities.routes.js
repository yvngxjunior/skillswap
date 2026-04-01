const { Router } = require('express');
const Joi = require('joi');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { getAvailabilities, setAvailabilities } = require('../controllers/availabilities.controller');

const router = Router();

const slotSchema = Joi.object({
  day_of_week: Joi.number().integer().min(0).max(6).required(),
  start_time:  Joi.string().pattern(/^([0-1]\d|2[0-3]):[0-5]\d$/).required(), // HH:MM
  end_time:    Joi.string().pattern(/^([0-1]\d|2[0-3]):[0-5]\d$/).required(),
});

const setAvailabilitiesSchema = Joi.object({
  slots: Joi.array().items(slotSchema).max(20).required(),
});

// GET /api/v1/availabilities/me
router.get('/me', authenticate, getAvailabilities);

// PUT /api/v1/availabilities/me  — full replace of own availability slots
router.put('/me', authenticate, validate(setAvailabilitiesSchema), setAvailabilities);

// GET /api/v1/availabilities/:userId  — view any user's availability
router.get('/:userId', authenticate, getAvailabilities);

module.exports = router;
