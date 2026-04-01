const { Router } = require('express');
const Joi = require('joi');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  listSkills,
  getUserSkills,
  addUserSkill,
  removeUserSkill,
} = require('../controllers/skills.controller');

const router = Router();

const addSkillSchema = Joi.object({
  skill_id: Joi.string().uuid().required(),
  type:     Joi.string().valid('offered', 'wanted').required(),
  level:    Joi.string().valid('beginner', 'intermediate', 'advanced', 'expert').required(),
});

// ─── Referential ─────────────────────────────────────────────────────────────
// GET /api/v1/skills                 — list all skills (with optional ?category= and ?q= filters)
router.get('/', authenticate, listSkills);

// ─── Own user skills ─────────────────────────────────────────────────────────
// GET  /api/v1/skills/me             — my skills
router.get('/me', authenticate, getUserSkills);

// POST /api/v1/skills/me             — add/update a skill
router.post('/me', authenticate, validate(addSkillSchema), addUserSkill);

// DELETE /api/v1/skills/me/:id       — remove a user skill
router.delete('/me/:userSkillId', authenticate, removeUserSkill);

// ─── Public user skills ───────────────────────────────────────────────────────
// GET /api/v1/skills/user/:userId    — skills of any user
router.get('/user/:userId', authenticate, getUserSkills);

module.exports = router;
