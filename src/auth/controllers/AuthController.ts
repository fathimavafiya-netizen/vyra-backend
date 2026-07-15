import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import authenticationFacade from '../facade/AuthenticationFacade';
import otpUtil from '../../utils/otp';
import logger from '../../utils/logger';
import prisma from '../../config/db';
import env from '../../config/env';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import auditService from '../services/AuditService';
import metricsService from '../../monitoring/metrics.service';
import sessionRepository from '../repositories/SessionRepository';
import deviceService from '../services/DeviceService';
import authService from '../../services/AuthService';

// Lazily-constructed Google OAuth2 client — only used when GOOGLE_CLIENT_ID is set.
const googleOAuth2Client = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

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

      await auditService.logEvent({
        action: 'OTP_GENERATED',
        severity: 'INFO',
        status: 'EMAIL_OTP_DISPATCHED',
        req,
      });
      await metricsService.incrementMetric('otp_generated');

      const isDev = process.env.NODE_ENV !== 'production';
      return res.status(200).json({
        success: true,
        message: `OTP sent to ${cleanEmail}`,
        data: isDev ? { devCode: code, devNote: 'Development mode active.' } : null,
      });
    } catch (e: any) {
      logger.error(`Send email OTP error: ${e.message}`);
      return res.status(400).json({ success: false, code: 'OTP_SEND_FAILED', message: e.message });
    }
  }

  async verifyEmailOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp, name, deviceId, deviceName, platform, appVersion, rememberDevice, pushToken } = req.body;
      const cleanEmail = email.trim().toLowerCase();

      // 1. Verify OTP code
      const { valid } = await otpUtil.verifyOtpFromDB(cleanEmail, otp, 'EMAIL');
      if (!valid) {
        await metricsService.incrementMetric('otp_failed');
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      await auditService.logEvent({
        action: 'OTP_VERIFIED',
        severity: 'INFO',
        status: 'EMAIL_OTP_SUCCESS',
        req,
      });
      await metricsService.incrementMetric('otp_verified');

      // 2. Delegate to Facade
      const result = await authenticationFacade.loginOrRegister({
        email: cleanEmail,
        name,
        deviceId,
        deviceName,
        platform,
        appVersion,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        rememberDevice: !!rememberDevice,
        pushToken,
      });

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

      await auditService.logEvent({
        action: 'OTP_GENERATED',
        severity: 'INFO',
        status: 'MOBILE_OTP_DISPATCHED',
        req,
      });
      await metricsService.incrementMetric('otp_generated');

      const isDev = process.env.NODE_ENV !== 'production';
      return res.status(200).json({
        success: true,
        message: `OTP sent to ${cleanMobile}`,
        data: isDev ? { devCode: code, devNote: 'Development mode active.' } : null,
      });
    } catch (e: any) {
      logger.error(`Send mobile OTP error: ${e.message}`);
      return res.status(400).json({ success: false, code: 'OTP_SEND_FAILED', message: e.message });
    }
  }

  async verifyMobileOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { mobile, otp, deviceId, deviceName, platform, appVersion, rememberDevice, pushToken } = req.body;
      const cleanMobile = mobile.trim();

      // 1. Verify OTP code
      const { valid } = await otpUtil.verifyOtpFromDB(cleanMobile, otp, 'MOBILE');
      if (!valid) {
        await metricsService.incrementMetric('otp_failed');
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      await auditService.logEvent({
        action: 'OTP_VERIFIED',
        severity: 'INFO',
        status: 'MOBILE_OTP_SUCCESS',
        req,
      });
      await metricsService.incrementMetric('otp_verified');

      // 2. Delegate to Facade
      const result = await authenticationFacade.loginOrRegister({
        mobile: cleanMobile,
        deviceId,
        deviceName,
        platform,
        appVersion,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        rememberDevice: !!rememberDevice,
        pushToken,
      });

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

      const result = await authenticationFacade.refreshTokens(
        refreshToken,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown'
      );

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
        await authenticationFacade.logout(
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

      const sessions = await sessionRepository.findActiveByUserId(userId);
      const devices = await deviceService.getDevicesByUser(userId);

      // Merge session details with device push tokens
      const merged = sessions.map(s => {
        const devProfile = devices.find(d => d.deviceId === s.deviceId);
        return {
          id: s.id,
          deviceId: s.deviceId,
          deviceName: s.deviceName,
          platform: s.platform,
          appVersion: s.appVersion,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          location: s.location,
          lastActive: s.lastActive,
          createdAt: s.createdAt,
          isTrusted: devProfile ? devProfile.trustedUntil > new Date() : false,
        };
      });

      return res.status(200).json({
        success: true,
        message: 'Devices retrieved successfully.',
        data: merged,
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

      const session = await sessionRepository.findById(deviceSessionId);

      if (!session || session.userId !== userId || !session.isValid) {
        return res.status(404).json({ success: false, code: 'DEVICE_NOT_FOUND', message: 'Active device session not found' });
      }

      await sessionRepository.invalidate(deviceSessionId);

      await auditService.logEvent({
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

  async trustDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const deviceSessionId = req.params.id;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const session = await sessionRepository.findById(deviceSessionId);

      if (!session || session.userId !== userId || !session.isValid) {
        return res.status(404).json({ success: false, code: 'DEVICE_NOT_FOUND', message: 'Active device session not found' });
      }

      await deviceService.registerOrUpdateDevice({
        userId,
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        platform: session.platform,
        rememberDevice: true,
      });

      return res.status(200).json({
        success: true,
        message: 'Device trust profile upgraded successfully (90 days valid).',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'DEVICE_TRUST_FAILED', message: e.message });
    }
  }

  async logoutAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Authentication required');
      }

      await authenticationFacade.deleteAccount(userId); // revoke all sessions

      clearAuthCookies(res);

      return res.status(200).json({
        success: true,
        message: 'Logged out of all devices successfully.',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'LOGOUT_ALL_FAILED', message: e.message });
    }
  }

  // ─── GDPR & ACCOUNT RECOVERY ───
  async changeEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { newEmail, otp } = req.body;

      if (!userId) {
        throw new Error('Authentication required');
      }

      // Verify OTP sent to new email
      const { valid } = await otpUtil.verifyOtpFromDB(newEmail, otp, 'EMAIL');
      if (!valid) {
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      await authenticationFacade.changeEmail(userId, newEmail, req.sessionId || '');

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

      if (!userId) {
        throw new Error('Authentication required');
      }

      // Verify OTP
      const { valid } = await otpUtil.verifyOtpFromDB(newMobile, otp, 'MOBILE');
      if (!valid) {
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      await authenticationFacade.changeMobile(userId, newMobile, req.sessionId || '');

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

      const dbUser = await prisma.user.findUnique({ where: { id: userId } });
      const contact = dbUser?.email || dbUser?.mobile;
      if (!contact) {
        throw new Error('No verified contact method found on user profile');
      }

      const { valid } = await otpUtil.verifyOtpFromDB(contact, otp, dbUser.email ? 'EMAIL' : 'MOBILE');
      if (!valid) {
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      await authenticationFacade.deleteAccount(userId);
      clearAuthCookies(res);

      return res.status(200).json({
        success: true,
        message: 'Account soft-deleted successfully.',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'ACCOUNT_DELETION_FAILED', message: e.message });
    }
  }

  async exportUserData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Authentication required');
      }

      const data = await authenticationFacade.exportUserData(userId);
      return res.status(200).json({
        success: true,
        message: 'GDPR User data exported successfully.',
        data,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, code: 'DATA_EXPORT_FAILED', message: e.message });
    }
  }

  // ─── CREDENTIALS & PASSWORD AUTH UPGRADES ───
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        fullName,
        username,
        email,
        mobile,
        countryCode,
        password,
        deviceId,
        deviceName,
        platform,
        appVersion,
        rememberDevice,
        pushToken,
      } = req.body;

      const bcrypt = require('bcryptjs');
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const cleanMobile = mobile ? mobile.trim() : null;

      // 1. Check duplicate registrations
      let existingUser = null;
      if (cleanEmail) {
        const userByEmail = await prisma.user.findUnique({ where: { email: cleanEmail }, include: { profile: true } });
        if (userByEmail) {
          const isAutoRegistered = !userByEmail.username || !userByEmail.password.startsWith('$2a$');
          if (isAutoRegistered) {
            existingUser = userByEmail;
          } else {
            return res.status(400).json({
              success: false,
              code: 'EMAIL_ALREADY_EXISTS',
              message: 'Email address already registered.'
            });
          }
        }
      }

      if (cleanMobile) {
        const userByMobile = await prisma.user.findUnique({ where: { mobile: cleanMobile }, include: { profile: true } });
        if (userByMobile) {
          const isAutoRegistered = !userByMobile.username || !userByMobile.password.startsWith('$2a$');
          if (isAutoRegistered) {
            if (!existingUser) existingUser = userByMobile;
          } else {
            return res.status(400).json({
              success: false,
              code: 'MOBILE_ALREADY_EXISTS',
              message: 'Mobile number already registered.'
            });
          }
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      let user;
      if (existingUser) {
        // Upgrade existing user!
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            fullName,
            username,
            password: passwordHash,
            passwordHash,
            phone: cleanMobile || existingUser.phone,
            countryCode: countryCode || existingUser.countryCode,
            provider: 'credentials',
            emailVerified: cleanEmail ? true : existingUser.emailVerified,
            phoneVerified: cleanMobile ? true : existingUser.phoneVerified,
            isVerified: true,
            emailVerifiedAt: cleanEmail ? new Date() : existingUser.emailVerifiedAt,
            mobileVerifiedAt: cleanMobile ? new Date() : existingUser.mobileVerifiedAt,
            profile: {
              upsert: {
                create: {
                  name: fullName,
                  username,
                },
                update: {
                  name: fullName,
                  username,
                }
              }
            }
          },
          include: {
            profile: true
          }
        });
      } else {
        // Check unique username
        const usernameExists = await prisma.profile.findUnique({ where: { username } });
        if (usernameExists) {
          return res.status(400).json({ success: false, code: 'USERNAME_TAKEN', message: 'Username is already taken.' });
        }

        // Create new User
        user = await prisma.user.create({
          data: {
            email: cleanEmail,
            mobile: cleanMobile,
            password: passwordHash,
            fullName,
            username,
            phone: cleanMobile,
            countryCode,
            passwordHash,
            provider: 'credentials',
            emailVerified: !!cleanEmail,
            phoneVerified: !!cleanMobile,
            isVerified: true,
            role: 'USER',
            emailVerifiedAt: cleanEmail ? new Date() : null,
            mobileVerifiedAt: cleanMobile ? new Date() : null,
            consentGivenAt: new Date(),
            privacyVersion: '1.0',
            termsVersion: '1.0',
            profile: {
              create: {
                name: fullName,
                username,
              },
            },
            settings: {
              create: {},
            },
          },
          include: {
            profile: true,
          },
        });
      }

      // Auto-login removed. Require explicit login step.
      return res.status(200).json({
        success: true,
        message: 'Registration successful. Please log in.',
        data: {
          user: {
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            phone: user.phone,
            countryCode: user.countryCode,
            profilePic: user.profile?.profilePic,
            role: user.role,
            isVerified: user.isVerified,
          }
        }
      });
    } catch (e: any) {
      logger.error(`Register error: ${e.message}`);
      return res.status(400).json({ success: false, code: 'REGISTRATION_FAILED', message: e.message });
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        email,
        mobile,
        password,
        deviceId,
        deviceName,
        platform,
        appVersion,
        rememberDevice,
        pushToken,
      } = req.body;

      const bcrypt = require('bcryptjs');
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const cleanMobile = mobile ? mobile.trim() : null;

      let user = null;
      if (cleanEmail) {
        user = await prisma.user.findUnique({
          where: { email: cleanEmail },
          include: { profile: true },
        });
      } else if (cleanMobile) {
        user = await prisma.user.findUnique({
          where: { mobile: cleanMobile },
          include: { profile: true },
        });
      }

      if (!user) {
        // Return the same response as wrong-password to prevent account enumeration.
        return res.status(400).json({ success: false, code: 'LOGIN_FAILED', message: 'Invalid credentials.' });
      }

      if (user.isBanned) {
        return res.status(403).json({ success: false, code: 'BANNED_USER', message: `Account is banned: ${user.bannedReason || 'Terms violation'}` });
      }

      // Check password — same error code/message as user-not-found to prevent enumeration.
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, code: 'LOGIN_FAILED', message: 'Invalid credentials.' });
      }

      // Reactivate user if they were deactivated (soft deleted)
      if (!user.isActive || user.deletedAt !== null) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isActive: true,
            deletedAt: null
          }
        });
        logger.info(`Reactivated user via password login: id=${user.id}`);
      }

      // Generate session & tokens via facade
      const result = await authenticationFacade.loginOrRegister({
        email: cleanEmail || undefined,
        mobile: cleanEmail ? undefined : (cleanMobile || undefined),
        deviceId,
        deviceName,
        platform,
        appVersion,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        rememberDevice: !!rememberDevice,
        pushToken,
      });

      setAuthCookies(res, result.accessToken, result.refreshToken, !!rememberDevice);

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        data: {
          user: {
            id: user.id,
            fullName: user.fullName || user.profile?.name,
            username: user.username || user.profile?.username,
            email: user.email,
            phone: user.phone || user.mobile,
            countryCode: user.countryCode,
            profilePic: user.profile?.profilePic,
            role: user.role,
            isVerified: user.isVerified,
            isAdminSession: user.role === 'ADMIN' || user.role === 'MODERATOR',
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (e: any) {
      logger.error(`Login error: ${e.message}`);
      return res.status(400).json({ success: false, code: 'LOGIN_FAILED', message: e.message });
    }
  }

  async sendGeneralOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, mobile, purpose = 'PASSWORD_RESET' } = req.body;
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const cleanMobile = mobile ? mobile.trim() : null;
      const contact = cleanEmail || cleanMobile;
      const type = cleanEmail ? 'EMAIL' : 'MOBILE';

      if (!contact) {
        return res.status(400).json({ success: false, message: 'Email or Mobile is required.' });
      }

      // If password reset, check if user exists
      if (purpose === 'PASSWORD_RESET') {
        const user = cleanEmail 
          ? await prisma.user.findUnique({ where: { email: cleanEmail } })
          : await prisma.user.findUnique({ where: { mobile: cleanMobile } });
        if (!user) {
          return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'No account registered with this contact details.' });
        }
      }

      const code = otpUtil.generateOtp();
      await otpUtil.saveOtpToDB(contact, code, type, purpose);

      if (type === 'EMAIL') {
        await otpUtil.sendOtpViaEmail(contact, code);
      } else {
        await otpUtil.sendOtpViaSms(contact, code);
      }

      const isDev = process.env.NODE_ENV !== 'production';
      return res.status(200).json({
        success: true,
        message: `OTP sent successfully.`,
        data: isDev ? { devCode: code } : null,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async verifyGeneralOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, mobile, otp, purpose = 'PASSWORD_RESET' } = req.body;
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const cleanMobile = mobile ? mobile.trim() : null;
      const contact = cleanEmail || cleanMobile;
      const type = cleanEmail ? 'EMAIL' : 'MOBILE';

      if (!contact || !otp) {
        return res.status(400).json({ success: false, message: 'Contact details and OTP are required.' });
      }

      const { valid } = await otpUtil.verifyOtpFromDB(contact, otp, type, purpose);
      if (!valid) {
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully.',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async google(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        idToken,
        deviceId,
        deviceName,
        platform,
        appVersion,
        rememberDevice,
        pushToken,
      } = req.body;

      // ── Token verification ──────────────────────────────────────────────────
      let googleSub: string;
      let email: string;
      let name: string;
      let picture: string;
      let emailVerified: boolean;

      if (googleOAuth2Client && env.GOOGLE_CLIENT_ID) {
        // ── Production path: real token verification ──────────────────────────
        const ticket = await googleOAuth2Client.verifyIdToken({
          idToken,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) {
          return res.status(401).json({ success: false, code: 'GOOGLE_LOGIN_FAILED', message: 'Invalid Google ID token.' });
        }

        googleSub      = payload.sub;
        email          = payload.email ?? '';
        name           = payload.name ?? email.split('@')[0];
        picture        = payload.picture ?? '';
        emailVerified  = payload.email_verified ?? false;

        // Policy: block sign-in for Google accounts with an unverified email.
        // This can occur in certain Workspace/org configurations.
        if (!emailVerified) {
          return res.status(401).json({
            success: false,
            code: 'GOOGLE_EMAIL_UNVERIFIED',
            message: "Your Google account's email address is not verified. Please verify it with Google and try again.",
          });
        }
      } else {
        // ── Dev bypass: GOOGLE_CLIENT_ID is not configured ────────────────────
        // Log a WARN on every hit so this state is impossible to miss in logs.
        logger.warn(
          '⚠️  GOOGLE_CLIENT_ID is not set — /auth/google is running in MOCK mode. ' +
          'This MUST NOT reach production. Set GOOGLE_CLIENT_ID in your environment.'
        );
        // Use a deterministic mock payload derived from the submitted token string
        // so development flows still exercise the user-create/lookup paths.
        googleSub     = `mock_sub_${idToken}`;
        email         = idToken.includes('@') ? idToken.toLowerCase().trim() : 'mock_google@example.com';
        name          = email.split('@')[0];
        picture       = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde';
        emailVerified = true;
      }
      // ────────────────────────────────────────────────────────────────────────

      const bcrypt = require('bcryptjs');

      // ── User lookup: googleSub first, email as migration fallback ────────────
      // Using sub as the primary key prevents account takeover via email reuse.
      // Email fallback covers accounts created before googleSub was stored.
      let user = await prisma.user.findUnique({
        where: { googleSub },
        include: { profile: true },
      });

      if (!user && email) {
        // Migration path: match by email for pre-existing accounts
        user = await prisma.user.findUnique({
          where: { email },
          include: { profile: true },
        });
        if (user && !user.googleSub) {
          // Stamp the googleSub onto the matched account so future logins use the fast path
          await prisma.user.update({
            where: { id: user.id },
            data: { googleSub, provider: 'google', profilePicture: picture, emailVerified: true },
          });
          user = { ...user, googleSub };
        }
      }

      // ── Role Authorization Check ──────────────────────────────────────────
      if (!user) {
        const requestedRole = req.body.role || 'USER';
        if (requestedRole === 'ADMIN') {
          return res.status(403).json({
            success: false,
            message: 'Access Denied: Cannot register new administrator accounts via Google.'
          });
        }
      }

      if (!user) {
        // First-time Google sign-in: create account
        const baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'googleuser';
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const username = `${baseUsername}_${suffix}`;
        const passwordPlaceholder = await bcrypt.hash(Math.random().toString(36).substring(2, 15), 10);

        user = await prisma.user.create({
          data: {
            email,
            password: passwordPlaceholder,
            fullName: name,
            username,
            passwordHash: passwordPlaceholder,
            provider: 'google',
            googleSub,
            profilePicture: picture,
            emailVerified: true,
            isVerified: true,
            role: 'USER',
            emailVerifiedAt: new Date(),
            consentGivenAt: new Date(),
            privacyVersion: '1.0',
            termsVersion: '1.0',
            profile: {
              create: {
                name,
                username,
                profilePic: picture,
              },
            },
            settings: {
              create: {},
            },
          },
          include: { profile: true },
        });
      }

      // Generate session & tokens via facade
      const result = await authenticationFacade.loginOrRegister({
        email,
        deviceId,
        deviceName,
        platform,
        appVersion,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        rememberDevice: !!rememberDevice,
        pushToken,
      });

      setAuthCookies(res, result.accessToken, result.refreshToken, !!rememberDevice);

      return res.status(200).json({
        success: true,
        message: 'Google Sign-In successful.',
        data: {
          user: {
            id: user.id,
            fullName: user.fullName || user.profile?.name,
            username: user.username || user.profile?.username,
            email: user.email,
            phone: user.phone || user.mobile,
            countryCode: user.countryCode,
            profilePic: user.profile?.profilePic,
            role: user.role,
            isVerified: user.isVerified,
            isAdminSession: user.role === 'ADMIN' || user.role === 'MODERATOR',
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (e: any) {
      // Never expose internal error details to the client — they could leak token structure
      logger.error(`Google Login error: ${e.message}`);
      return res.status(400).json({ success: false, code: 'GOOGLE_LOGIN_FAILED', message: 'Google Sign-In failed. Please try again.' });
    }
  }

  async checkUsername(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.query as { username?: string };

      if (!username || typeof username !== 'string') {
        return res.status(400).json({ success: false, code: 'INVALID_QUERY', message: 'username query parameter is required.' });
      }

      // Validate format server-side before hitting the DB
      const usernameRegex = /^[a-z0-9_]{3,30}$/i;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_USERNAME_FORMAT',
          message: 'Username must be 3–30 characters and contain only letters, numbers, and underscores.',
          available: false,
        });
      }

      const existing = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
        select: { id: true },
      });

      return res.status(200).json({ success: true, available: !existing });
    } catch (e: any) {
      logger.error(`checkUsername error: ${e.message}`);
      return res.status(500).json({ success: false, code: 'CHECK_USERNAME_FAILED', message: 'Could not check username availability.' });
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, mobile } = req.body;
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const cleanMobile = mobile ? mobile.trim() : null;
      const contact = cleanEmail || cleanMobile;
      const type = cleanEmail ? 'EMAIL' : 'MOBILE';

      const user = cleanEmail 
        ? await prisma.user.findUnique({ where: { email: cleanEmail } })
        : await prisma.user.findUnique({ where: { mobile: cleanMobile } });

      if (!user) {
        return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'No account registered with this contact details.' });
      }

      const code = otpUtil.generateOtp();
      await otpUtil.saveOtpToDB(contact, code, type, 'PASSWORD_RESET');

      if (type === 'EMAIL') {
        await otpUtil.sendOtpViaEmail(contact, code);
      } else {
        await otpUtil.sendOtpViaSms(contact, code);
      }

      const isDev = process.env.NODE_ENV !== 'production';
      return res.status(200).json({
        success: true,
        message: `Reset OTP sent successfully.`,
        data: isDev ? { devCode: code } : null,
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, mobile, otp, password } = req.body;
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const cleanMobile = mobile ? mobile.trim() : null;
      const contact = cleanEmail || cleanMobile;
      const type = cleanEmail ? 'EMAIL' : 'MOBILE';

      // 1. Verify OTP (accepts either a pre-verified session record or direct code check)
      let isVerified = false;
      const record = await prisma.otpVerification.findUnique({
        where: {
          contact_type_purpose: { contact, type, purpose: 'PASSWORD_RESET' },
        },
      });

      if (record && record.verified && record.expiresAt > new Date()) {
        isVerified = true;
        // Invalidate record so it cannot be reused
        await prisma.otpVerification.update({
          where: { id: record.id },
          data: { verified: false, expiresAt: new Date(0) },
        });
      } else {
        const { valid } = await otpUtil.verifyOtpFromDB(contact, otp, type, 'PASSWORD_RESET');
        isVerified = valid;
      }

      if (!isVerified) {
        return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid or expired OTP.' });
      }

      // Find user
      const user = cleanEmail 
        ? await prisma.user.findUnique({ where: { email: cleanEmail } })
        : await prisma.user.findUnique({ where: { mobile: cleanMobile } });

      if (!user) {
        return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found.' });
      }

      // Hash password
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: passwordHash,
          passwordHash,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Password reset successfully.',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          fullName: user.fullName || user.profile?.name,
          username: user.username || user.profile?.username,
          email: user.email,
          phone: user.phone || user.mobile,
          countryCode: user.countryCode,
          profilePic: user.profile?.profilePic,
          role: user.role,
          isVerified: user.isVerified,
          isAdminSession: req.user?.isAdminSession || false,
        },
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
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
