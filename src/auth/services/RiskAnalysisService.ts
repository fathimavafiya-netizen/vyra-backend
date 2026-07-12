import logger from '../../utils/logger';
import sessionRepository from '../repositories/SessionRepository';
import auditService from './AuditService';

export class RiskAnalysisService {
  /**
   * Evaluates login risk score based on historical metadata
   * Returns a risk score (0 to 100). Scores above 50 trigger secondary verify checks or alerts.
   */
  async evaluateRisk(data: {
    userId: string;
    ipAddress: string;
    deviceId: string;
    userAgent: string;
  }): Promise<{ score: number; triggers: string[] }> {
    const triggers: string[] = [];
    let score = 0;

    try {
      const activeSessions = await sessionRepository.findActiveByUserId(data.userId);

      if (activeSessions.length === 0) {
        // First login / no active sessions
        score += 10;
        triggers.push('FIRST_SESSION_CREATION');
      } else {
        // 1. Check if device is new
        const matchesDevice = activeSessions.some(s => s.deviceId === data.deviceId);
        if (!matchesDevice) {
          score += 30;
          triggers.push('NEW_DEVICE_FINGERPRINT');
        }

        // 2. Check if IP address is new
        const matchesIp = activeSessions.some(s => s.ipAddress === data.ipAddress);
        if (!matchesIp) {
          score += 20;
          triggers.push('NEW_IP_ADDRESS');
        }

        // 3. Check if user agent matches
        const matchesUa = activeSessions.some(s => s.userAgent === data.userAgent);
        if (!matchesUa) {
          score += 10;
          triggers.push('NEW_USER_AGENT');
        }
      }
    } catch (err: any) {
      logger.error(`[RiskAnalysis] Risk check error: ${err.message}`);
    }

    if (score >= 50) {
      await auditService.logEvent({
        userId: data.userId,
        action: 'ACCOUNT_LOCKED', // lockout/challenge risk log
        severity: 'WARNING',
        status: `HIGH_RISK_LOGIN_DETECTED_SCORE_${score}_TRIGGERS_${triggers.join(',')}`,
        ipAddress: data.ipAddress,
        deviceId: data.deviceId,
        userAgent: data.userAgent,
      });
    }

    return { score, triggers };
  }
}

export default new RiskAnalysisService();
