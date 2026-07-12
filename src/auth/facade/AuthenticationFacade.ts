import sessionService from '../services/SessionService';
import tokenService from '../services/TokenService';
import deviceService from '../services/DeviceService';
import riskAnalysisService from '../services/RiskAnalysisService';
import recoveryService from '../services/RecoveryService';
import userRepository from '../repositories/UserRepository';
import auditService from '../services/AuditService';
import notificationService from '../services/NotificationService';
import metricsService from '../../monitoring/metrics.service';
import queueManager from '../../queue/queue';

export class AuthenticationFacade {
  /**
   * Log in user or register if new account
   */
  async loginOrRegister(data: {
    email?: string;
    mobile?: string;
    name?: string;
    deviceId: string;
    deviceName: string;
    platform: string;
    appVersion: string;
    ipAddress: string;
    userAgent: string;
    rememberDevice?: boolean;
    pushToken?: string;
  }) {
    let user = null;
    let isNewRegistration = false;

    if (data.email) {
      user = await userRepository.findByEmail(data.email);
    } else if (data.mobile) {
      user = await userRepository.findByMobile(data.mobile);
    }

    if (!user) {
      // 1. Auto-Register
      const name = data.name || (data.email ? data.email.split('@')[0] : `User_${data.mobile?.slice(-4)}`);
      // Generates secure random handle
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const username = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${suffix}`;

      const bcrypt = require('bcryptjs');
      const generatedPass = Math.random().toString(36).substring(2, 12);
      const hashedPassword = await bcrypt.hash(generatedPass, 10);

      user = await userRepository.create({
        email: data.email,
        mobile: data.mobile,
        passwordHash: hashedPassword,
        name,
        username,
        consentGiven: true,
      });
      isNewRegistration = true;
    }

    // Reactivate user if they were deactivated (soft deleted)
    if (!user.isActive || user.deletedAt !== null) {
      await userRepository.updateStatus(user.id, {
        isActive: true,
        deletedAt: null as any
      });
      user.isActive = true;
      user.deletedAt = null;
    }

    // 2. Risk Detection Check
    const risk = await riskAnalysisService.evaluateRisk({
      userId: user.id,
      ipAddress: data.ipAddress,
      deviceId: data.deviceId,
      userAgent: data.userAgent,
    });

    // 3. Create Session (Evicts oldest session if > 5)
    const isAdmin = user.role === 'ADMIN' || user.role === 'MODERATOR';
    const sessionDetails = await sessionService.createSession(
      user.id,
      {
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        platform: data.platform,
        appVersion: data.appVersion,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        rememberDevice: !!data.rememberDevice,
      },
      user.role,
      isAdmin ? { isAdminSession: true } : {}
    );

    // 4. Update Device Trusted profile
    await deviceService.registerOrUpdateDevice({
      userId: user.id,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      platform: data.platform,
      pushToken: data.pushToken,
      rememberDevice: !!data.rememberDevice,
    });

    // 5. Trigger Security Alerts (Out of band background jobs)
    if (risk.score >= 50) {
      await queueManager.addJob('security_alert', {
        email: user.email,
        mobile: user.mobile,
        alertType: 'NEW_DEVICE_LOGIN',
        details: `Login with high risk score (${risk.score}) from device ${data.deviceName}`,
      }, 'high');
    }

    await auditService.logEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      severity: 'INFO',
      status: isNewRegistration ? 'AUTO_REGISTER_LOGIN' : 'SUCCESSFUL_LOGIN',
      ipAddress: data.ipAddress,
      deviceId: data.deviceId,
      userAgent: data.userAgent,
    });

    await metricsService.incrementMetric('login_success');

    return {
      user: {
        id: user.id,
        name: user.profile!.name,
        username: user.profile!.username,
        email: user.email,
        mobile: user.mobile,
        profilePic: user.profile!.profilePic,
        role: user.role,
        isVerified: user.isVerified,
        mfaEnabled: user.mfaEnabled,
        isAdminSession: isAdmin,
      },
      ...sessionDetails,
    };
  }

  /**
   * Refreshes access tokens and validates RTR replay protection
   */
  async refreshTokens(refreshToken: string, ipAddress: string, userAgent: string) {
    return sessionService.rotateSession(refreshToken, ipAddress, userAgent);
  }

  /**
   * Logs out active session
   */
  async logout(refreshToken: string, ipAddress: string, userAgent: string) {
    return sessionService.revokeSessionByToken(refreshToken, ipAddress, userAgent);
  }

  /**
   * Change user primary email snapshot
   */
  async changeEmail(userId: string, newEmail: string, currentSessionId: string) {
    return recoveryService.migrateEmail(userId, newEmail, currentSessionId);
  }

  /**
   * Change user primary mobile snapshot
   */
  async changeMobile(userId: string, newMobile: string, currentSessionId: string) {
    return recoveryService.migrateMobile(userId, newMobile, currentSessionId);
  }

  /**
   * Terminate/Soft delete user account Snapshots
   */
  async deleteAccount(userId: string) {
    return recoveryService.softDeleteAccount(userId);
  }

  /**
   * Exports data complying GDPR
   */
  async exportUserData(userId: string) {
    return recoveryService.exportUserData(userId);
  }
}

export default new AuthenticationFacade();
