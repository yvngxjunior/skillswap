const { Router } = require('express');
const Joi = require('joi');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createExchange,
  listExchanges,
  getExchange,
  respondExchange,
  confirmExchange,
} = require('../controllers/exchanges.controller');
const { getMessages, sendMessage } = require('../controllers/messages.controller');
const { createReview } = require('../controllers/reviews.controller');

const router = Router();

const createSchema = Joi.object({
  partner_id:       Joi.string().uuid().required(),
  skill_id:         Joi.string().uuid().required(),
  duration_minutes: Joi.number().integer().min(15).max(480).default(60),
  desired_date:     Joi.date().iso().min('now').optional().allow(null),
  message:          Joi.string().max(500).allow('').default(''),
});

const respondSchema = Joi.object({
  action: Joi.string().valid('accept', 'cancel').required(),
});

const messageSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required(),
});

const reviewSchema = Joi.object({
  punctuality: Joi.number().integer().min(1).max(5).required(),
  pedagogy:    Joi.number().integer().min(1).max(5).required(),
  respect:     Joi.number().integer().min(1).max(5).required(),
  overall:     Joi.number().integer().min(1).max(5).required(),
  comment:     Joi.string().max(300).allow('').default(''),
});

// Exchanges CRUD
router.post  ('/',                   authenticate, validate(createSchema),  createExchange);
router.get   ('/',                   authenticate,                          listExchanges);
router.get   ('/:exchangeId',        authenticate,                          getExchange);
router.patch ('/:exchangeId/respond', authenticate, validate(respondSchema), respondExchange);
router.patch ('/:exchangeId/confirm', authenticate,                          confirmExchange);

// Messages (REST fallback)
router.get   ('/:exchangeId/messages',      authenticate,                          getMessages);
router.post  ('/:exchangeId/messages',      authenticate, validate(messageSchema),  sendMessage);

// Reviews
router.post  ('/:exchangeId/reviews',       authenticate, validate(reviewSchema),   createReview);

module.exports = router;
