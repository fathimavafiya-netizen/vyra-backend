import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authController from '../controllers/AuthController';
import authMiddleware from '../middleware/authMiddleware';
import validate from '../../middleware/validationMiddleware';
import validators from '../validators/auth.validator';
import env from '../../config/env';

const router = Router();

// ─── RATE LIMITERS ────────────────────────────────────────────────────────────
// Skip all limits in development to keep local testing frictionless.
const isDev = env.NODE_ENV === 'development';

/** 10 attempts per 15 min per IP — covers credential & Google endpoints */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many attempts. Please try again in 15 minutes.' },
});

/** 5 attempts per 15 min per IP — OTP send/verify endpoints */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100_000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many OTP requests. Please wait before trying again.' },
});

/** 30 attempts per 1 min per IP — username check endpoint */
const checkUsernameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100_000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many username checks. Please slow down.' },
});
// ─────────────────────────────────────────────────────────────────────────────

// ─── OTP LOGINS ───
router.post('/email/send-otp', otpLimiter, validate(validators.sendEmailOtpSchema), authController.sendEmailOtp);
router.post('/email/verify-otp', otpLimiter, validate(validators.verifyEmailOtpSchema), authController.verifyEmailOtp);

router.post('/mobile/send-otp', otpLimiter, validate(validators.sendMobileOtpSchema), authController.sendMobileOtp);
router.post('/mobile/verify-otp', otpLimiter, validate(validators.verifyMobileOtpSchema), authController.verifyMobileOtp);

// ─── CREDENTIALS & GOOGLE SIGN-IN ───
router.post('/register', authLimiter, validate(validators.registerSchema), authController.register as any);
router.post('/login', authLimiter, validate(validators.loginSchema), authController.login as any);
router.post('/admin/login', authLimiter, authController.adminLogin as any);
router.post('/send-otp', otpLimiter, authController.sendGeneralOtp as any);
router.post('/verify-otp', otpLimiter, authController.verifyGeneralOtp as any);
router.post('/google', authLimiter, validate(validators.googleSchema), authController.google as any);
router.post('/forgot-password', authLimiter, validate(validators.forgotPasswordSchema), authController.forgotPassword as any);
router.post('/reset-password', authLimiter, validate(validators.resetPasswordSchema), authController.resetPassword as any);
router.get('/me', authMiddleware as any, authController.me as any);

// ─── USERNAME AVAILABILITY ───
router.get('/check-username', checkUsernameLimiter, authController.checkUsername as any);

// ─── SESSIONS & ROTATIONS ───
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// ─── DEVICE MANAGEMENT ───
router.get('/devices', authMiddleware as any, authController.getDevices as any);
router.delete('/devices/:id', authMiddleware as any, authController.revokeDevice as any);
router.patch('/devices/:id/trust', authMiddleware as any, authController.trustDevice as any);
router.delete('/logout-all', authMiddleware as any, authController.logoutAll as any);

// ─── GDPR & ACCOUNT MIGRATIONS ───
router.patch('/email', authMiddleware as any, validate(validators.changeEmailSchema), authController.changeEmail as any);
router.patch('/mobile', authMiddleware as any, validate(validators.changeMobileSchema), authController.changeMobile as any);
router.delete('/account', authMiddleware as any, validate(validators.deleteAccountSchema), authController.deleteAccount as any);
router.get('/export', authMiddleware as any, authController.exportUserData as any);

export default router;
