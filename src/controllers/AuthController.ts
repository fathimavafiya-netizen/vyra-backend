import { Request, Response, NextFunction } from 'express';
import authService from '../services/AuthService';
import userRepository from '../repositories/UserRepository';
import otpUtil from '../utils/otp';
import logger from '../utils/logger';
import prisma from '../config/db';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { logAuditEvent } from '../utils/audit';
import { incrementMetric } from '../utils/metrics';

/**
 * Helper to set cookies for Web Clients
 */
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string, rememberDevice = false) => {
  const cookieExpiry = (rememberDevice ? env.TRUSTED_DEVICE_DAYS : 7) * 24 * 60 * 60 * 1000;

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: cookieExpiry,
  });
};

/**
 * Helper to clear auth cookies
 */
const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', { domain: env.COOKIE_DOMAIN || undefined });
  res.clearCookie('refreshToken', { domain: env.COOKIE_DOMAIN || undefined });
};

export class AuthController {
  // ─── EMAIL OTP ENDPOINTS ───
  async sendEmailOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const cleanEmail = email.trim().toLowerCase();

      const code = otpUtil.generateOtp();
      await otpUtil.saveOtpToDB(cleanEmail, code, 'EMAIL');
      const result = await otpUtil.sendOtpViaEmail(cleanEmail, code);

      await logAuditEvent({
        action: 'OTP_GENERATED',
        severity: 'INFO',
        status: 'EMAIL_OTP_DISPATCHED',
        req,
        ipAddress: req.ip,
      });
      await incrementMetric('otp_generated');

      return res.status(200).json({
        success: true,
        message: `OTP sent to ${cleanEmail}`,
        data: result.devCode ? { devCode: result.devCode, devNote: 'Development mode active.' } : null,
      });
    } catch (e: any) {
      logger.error(`Send email OTP error: ${e.message}`);
      return res.status(400).json({ success: false, code: 'OTP_SEND_FAILED', message: e.message });
    }
  }

  async verifyEmailOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp, name, deviceId, deviceName, platform, appVersion, rememberDevice } = req.body;
      const cleanEmail = email.trim().toLowerCase();

      // 1. Verify OTP code
      const { valid } = await otpUtil.verifyOtpFromDB(cleanEmail, otp, 'EMAIL');
      if (!valid) {
        await incrementMetric('otp_failed');
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      await logAuditEvent({
        action: 'OTP_VERIFIED',
        severity: 'INFO',
        status: 'EMAIL_OTP_SUCCESS',
        req,
      });
      await incrementMetric('otp_verified');

      // 2. Login or Auto-Register user
      let result;
      try {
        result = await authService.login({
          email: cleanEmail,
          deviceId,
          deviceName,
          platform,
          appVersion,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
          rememberDevice: !!rememberDevice,
        });
      } catch (err: any) {
        // User not found -> register
        const userName = name || `User_${Math.floor(1000 + Math.random() * 9000)}`;
        result = await authService.register({
          name: userName,
          email: cleanEmail,
          deviceId,
          deviceName,
          platform,
          appVersion,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
          rememberDevice: !!rememberDevice,
        });
      }

      // 3. Set cookies
      setAuthCookies(res, result.accessToken, result.refreshToken, !!rememberDevice);

      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully.',
        data: result,
      });
    } catch (e: any) {
      logger.error(`Verify email OTP error: ${e.message}`);
      return res.status(400).json({ success: false, code: 'OTP_VERIFICATION_FAILED', message: e.message });
    }
  }

  // ─── MOBILE OTP ENDPOINTS ───
  async sendMobileOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { mobile } = req.body;
      const cleanMobile = mobile.trim();

      const code = otpUtil.generateOtp();
      await otpUtil.saveOtpToDB(cleanMobile, code, 'MOBILE');
      const result = await otpUtil.sendOtpViaSms(cleanMobile, code);

      await logAuditEvent({
        action: 'OTP_GENERATED',
        severity: 'INFO',
        status: 'MOBILE_OTP_DISPATCHED',
        req,
        ipAddress: req.ip,
      });
      await incrementMetric('otp_generated');

      return res.status(200).json({
        success: true,
        message: `OTP sent to ${cleanMobile}`,
        data: result.devCode ? { devCode: result.devCode, devNote: 'Development mode active.' } : null,
      });
    } catch (e: any) {
      logger.error(`Send mobile OTP error: ${e.message}`);
      return res.status(400).json({ success: false, code: 'OTP_SEND_FAILED', message: e.message });
    }
  }

  async verifyMobileOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { mobile, otp, deviceId, deviceName, platform, appVersion, rememberDevice } = req.body;
      const cleanMobile = mobile.trim();

      // 1. Verify OTP code
      const { valid } = await otpUtil.verifyOtpFromDB(cleanMobile, otp, 'MOBILE');
      if (!valid) {
        await incrementMetric('otp_failed');
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      await logAuditEvent({
        action: 'OTP_VERIFIED',
        severity: 'INFO',
        status: 'MOBILE_OTP_SUCCESS',
        req,
      });
      await incrementMetric('otp_verified');

      // 2. Login or Auto-Register user
      let result;
      try {
        result = await authService.login({
          mobile: cleanMobile,
          deviceId,
          deviceName,
          platform,
          appVersion,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
          rememberDevice: !!rememberDevice,
        });
      } catch (err: any) {
        // User not found -> register
        const userName = `User_${cleanMobile.slice(-4)}`;
        result = await authService.register({
          name: userName,
          mobile: cleanMobile,
          deviceId,
          deviceName,
          platform,
          appVersion,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
          rememberDevice: !!rememberDevice,
        });
      }

      // 3. Set cookies
      setAuthCookies(res, result.accessToken, result.refreshToken, !!rememberDevice);

      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully.',
        data: result,
      });
    } catch (e: any) {
      logger.error(`Verify mobile OTP error: ${e.message}`);
      return res.status(400).json({ success: false, code: 'OTP_VERIFICATION_FAILED', message: e.message });
    }
  }

  // ─── REFRESH & LOGOUT ENDPOINTS ───
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
      if (!refreshToken) {
        return res.status(400).json({ success: false, code: 'REFRESH_TOKEN_REQUIRED', message: 'Refresh token is required' });
      }

      const result = await authService.refreshToken({
        refreshToken,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
      });

      // Update cookies
      setAuthCookies(res, result.accessToken, result.refreshToken, true);

      return res.status(200).json({
        success: true,
        message: 'Tokens rotated successfully.',
        data: result,
      });
    } catch (e: any) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, code: 'SESSION_REVOKED', message: e.message });
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
      if (refreshToken) {
        await authService.logout(
          refreshToken,
          req.ip || 'unknown',
          req.get('user-agent') || 'unknown'
        );
      }

      clearAuthCookies(res);

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'LOGOUT_FAILED', message: e.message });
    }
  }

  // ─── DEVICE MANAGEMENT ENDPOINTS ───
  async getDevices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Authentication required');
      }

      const sessions = await prisma.session.findMany({
        where: { userId, isValid: true },
        select: {
          id: true,
          deviceId: true,
          deviceName: true,
          platform: true,
          appVersion: true,
          ipAddress: true,
          userAgent: true,
          location: true,
          lastActive: true,
          createdAt: true,
        },
        orderBy: { lastActive: 'desc' },
      });

      return res.status(200).json({
        success: true,
        message: 'Devices retrieved successfully.',
        data: sessions,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'DEVICES_FETCH_FAILED', message: e.message });
    }
  }

  async revokeDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const deviceSessionId = req.params.id;

      if (!userId) {
        throw new Error('Authentication required');
      }

      // Verify the session belongs to the user
      const session = await prisma.session.findFirst({
        where: { id: deviceSessionId, userId, isValid: true },
      });

      if (!session) {
        return res.status(404).json({ success: false, code: 'DEVICE_NOT_FOUND', message: 'Active device session not found' });
      }

      await prisma.session.update({
        where: { id: deviceSessionId },
        data: { isValid: false },
      });

      await logAuditEvent({
        userId,
        action: 'SESSION_REVOKED',
        severity: 'INFO',
        status: `REVOKED_DEVICE_SESSION_ID_${deviceSessionId}`,
        req,
      });

      return res.status(200).json({
        success: true,
        message: 'Device revoked successfully.',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'DEVICE_REVOCATION_FAILED', message: e.message });
    }
  }

  async logoutAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Authentication required');
      }

      await prisma.session.updateMany({
        where: { userId, isValid: true },
        data: { isValid: false },
      });

      await logAuditEvent({
        userId,
        action: 'LOGOUT',
        severity: 'WARNING',
        status: 'LOGOUT_ALL_DEVICES_TRIGGERED',
        req,
      });

      clearAuthCookies(res);

      return res.status(200).json({
        success: true,
        message: 'Logged out of all devices successfully.',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'LOGOUT_ALL_FAILED', message: e.message });
    }
  }

  // ─── ACCOUNT RECOVERY & SENSITIVE OPERATIONS ───
  async changeEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { newEmail, otp } = req.body;
      const cleanEmail = newEmail.trim().toLowerCase();

      if (!userId) {
        throw new Error('Authentication required');
      }

      // Check duplicate
      const duplicate = await userRepository.findByEmail(cleanEmail);
      if (duplicate) {
        return res.status(400).json({ success: false, code: 'EMAIL_DUPLICATE', message: 'Email address already in use.' });
      }

      // Verify OTP sent to new email
      const { valid } = await otpUtil.verifyOtpFromDB(cleanEmail, otp, 'EMAIL');
      if (!valid) {
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      // Apply change
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: cleanEmail,
          emailVerifiedAt: new Date(),
          emailVerificationPending: false,
        },
      });

      // Revoke all other active sessions (force re-login for security)
      await authService.logoutOtherDevices(userId, req.sessionId || '');

      await logAuditEvent({
        userId,
        action: 'PASSWORD_RESET', // representing account credentials change
        severity: 'SECURITY',
        status: `EMAIL_CHANGED_TO_${cleanEmail}_OTHER_DEVICES_REVOKED`,
        req,
      });

      return res.status(200).json({
        success: true,
        message: 'Email address updated successfully. Other device sessions revoked for safety.',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'EMAIL_CHANGE_FAILED', message: e.message });
    }
  }

  async changeMobile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { newMobile, otp } = req.body;
      const cleanMobile = newMobile.trim();

      if (!userId) {
        throw new Error('Authentication required');
      }

      const duplicate = await userRepository.findByMobile(cleanMobile);
      if (duplicate) {
        return res.status(400).json({ success: false, code: 'MOBILE_DUPLICATE', message: 'Mobile number already in use.' });
      }

      // Verify OTP
      const { valid } = await otpUtil.verifyOtpFromDB(cleanMobile, otp, 'MOBILE');
      if (!valid) {
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      // Apply change
      await prisma.user.update({
        where: { id: userId },
        data: {
          mobile: cleanMobile,
          mobileVerifiedAt: new Date(),
          mobileVerificationPending: false,
        },
      });

      // Revoke other devices
      await authService.logoutOtherDevices(userId, req.sessionId || '');

      await logAuditEvent({
        userId,
        action: 'PASSWORD_RESET',
        severity: 'SECURITY',
        status: `MOBILE_CHANGED_TO_${cleanMobile}_OTHER_DEVICES_REVOKED`,
        req,
      });

      return res.status(200).json({
        success: true,
        message: 'Mobile number updated successfully. Other device sessions revoked for safety.',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'MOBILE_CHANGE_FAILED', message: e.message });
    }
  }

  async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { otp } = req.body;

      if (!userId) {
        throw new Error('Authentication required');
      }

      // OTP Verification: use user's verified contact
      const dbUser = await prisma.user.findUnique({ where: { id: userId } });
      const contact = dbUser?.email || dbUser?.mobile;
      if (!contact) {
        throw new Error('No verified contact method found on user profile');
      }

      const { valid } = await otpUtil.verifyOtpFromDB(contact, otp, dbUser.email ? 'EMAIL' : 'MOBILE');
      if (!valid) {
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      // Soft-Delete: set flags
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      // Revoke all sessions immediately
      await prisma.session.updateMany({
        where: { userId, isValid: true },
        data: { isValid: false },
      });

      await logAuditEvent({
        userId,
        action: 'LOGOUT',
        severity: 'CRITICAL',
        status: 'ACCOUNT_SOFT_DELETED_BY_USER',
        req,
      });

      clearAuthCookies(res);

      return res.status(200).json({
        success: true,
        message: 'Account soft-deleted successfully.',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'ACCOUNT_DELETION_FAILED', message: e.message });
    }
  }

  async adminLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { emailOrUsername, password, deviceId, deviceName, platform, appVersion, rememberDevice } = req.body;
      
      const result = await authService.adminLogin({
        emailOrUsername,
        password,
        deviceId: deviceId || 'admin-panel-client',
        deviceName: deviceName || 'Admin Portal Client',
        platform: platform || 'WEB',
        appVersion: appVersion || '1.0.0',
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        rememberDevice: !!rememberDevice,
      });

      setAuthCookies(res, result.accessToken, result.refreshToken, !!rememberDevice);

      return res.status(200).json({
        success: true,
        message: 'Admin portal login successful.',
        data: result,
      });
    } catch (e: any) {
      logger.error(`Admin login error: ${e.message}`);
      return res.status(400).json({ success: false, code: 'ADMIN_LOGIN_FAILED', message: e.message });
    }
  }
}

export default new AuthController();
