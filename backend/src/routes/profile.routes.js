'use strict';

const { Router } = require('express');
const multer     = require('multer');
const path       = require('path');
const { z }      = require('zod');
const crypto     = require('crypto');

const { authenticate }   = require('../middlewares/auth.middleware');
const {
  getProfile,
  updateProfile,
  exportMyData,
  deleteMyAccount,
} = require('../controllers/profile.controller');

const router = Router();

// ─── Avatar upload ─────────────────────────────────────────────
// Allowed MIME types; also checked via magic bytes in the fileFilter
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Magic-byte signatures for the allowed image types
const MAGIC_BYTES = [
  { mime: 'image/jpeg', hex: 'ffd8ff',   offset: 0 },
  { mime: 'image/png',  hex: '89504e47', offset: 0 },
  { mime: 'image/webp', hex: '52494646', offset: 0 },
];

/**
 * Validate the first 4 bytes of the uploaded buffer against known
 * magic-byte signatures to guard against MIME-type spoofing.
 *
 * @param {Buffer} buf
 * @returns {boolean}
 */
function hasValidMagicBytes(buf) {
  return MAGIC_BYTES.some(({ hex, offset }) => {
    const slice = buf.slice(offset, offset + hex.length / 2).toString('hex');
    return slice === hex;
  });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  /**
   * Generate a cryptographically random, extension-preserving filename.
   * Using crypto.randomBytes avoids timing attacks on predictable names.
   */
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
    files:    1,
  },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(Object.assign(new Error('Only JPEG, PNG, or WebP images are allowed.'), { status: 415 }));
    }
    cb(null, true);
  },
});

// ─── Zod validation schemas ─────────────────────────────────────

const updateProfileSchema = z.object({
  pseudo: z.string().regex(/^[a-zA-Z0-9_]+$/, 'Pseudo may only contain letters, digits, or underscores').min(3).max(50).optional(),
  bio:    z.string().max(500).optional(),
});

/**
 * Inline Zod validation middleware factory.
 *
 * @param {z.ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        error: {
          code:    'VALIDATION_ERROR',
          message: 'Request body validation failed.',
          details: result.error.flatten().fieldErrors,
        },
      });
    }
    req.body = result.data;
    next();
  };
}

// ─── Routes ──────────────────────────────────────────────────

// Must be declared before /:userId so /me is not caught as a param
router.get('/me/data', authenticate, exportMyData);
router.delete('/me',   authenticate, deleteMyAccount);
router.get('/me',      authenticate, getProfile);
router.put(
  '/me',
  authenticate,
  upload.single('photo'),
  validateBody(updateProfileSchema),
  updateProfile
);

// Public profile view
router.get('/:userId', authenticate, getProfile);

module.exports = router;
