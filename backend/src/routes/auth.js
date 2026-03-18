import express from 'express';
import { body, validationResult } from 'express-validator';
import authController from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores and hyphens'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const refreshTokenValidation = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

router.post('/register', registerValidation, validate, authController.register);
router.post('/login',    loginValidation,    validate, authController.login);
router.post('/refresh',  refreshTokenValidation, validate, authController.refreshToken);
router.post('/logout',   authController.logout);
router.get('/profile',   authenticateToken,  authController.getProfile);

router.post('/forgot-password', [
  body('email').isEmail().withMessage('Please provide a valid email address'),
], validate, (req, res) => res.status(501).json({ success: false, message: 'Not yet implemented' }));

router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], validate, (req, res) => res.status(501).json({ success: false, message: 'Not yet implemented' }));

router.post('/verify-email', [
  body('token').notEmpty().withMessage('Verification token is required'),
], validate, (req, res) => res.status(501).json({ success: false, message: 'Not yet implemented' }));

router.post('/resend-verification', authenticateToken, (req, res) =>
  res.status(501).json({ success: false, message: 'Not yet implemented' })
);

export default router;