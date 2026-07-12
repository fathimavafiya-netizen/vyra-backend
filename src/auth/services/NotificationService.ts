import logger from '../../utils/logger';
import emailProvider from '../providers/email/ResendProvider';
import smsProvider from '../providers/sms/TwilioProvider';

export class NotificationService {
  /**
   * Dispatch security notifications (overriding normal preference checks)
   */
  async sendSecurityAlert(data: {
    email?: string | null;
    mobile?: string | null;
    alertType: 'NEW_DEVICE_LOGIN' | 'REPLAY_ATTACK_DETECTED' | 'ACCOUNT_LOCKOUT' | 'EMAIL_CHANGED' | 'MOBILE_CHANGED';
    details: string;
  }): Promise<void> {
    const subject = `⚠️ Vyra Security Alert: ${data.alertType.replace(/_/g, ' ')}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0c0d14; color: #fff; border-radius: 12px; border: 1px solid #ff4a4a;">
        <h2 style="color: #ff4a4a; margin-top: 0;">Security Alert</h2>
        <p style="color: #c5c6c7; line-height: 20px;">
          We detected a critical security event on your Vyra account:
        </p>
        <div style="background: rgba(255, 74, 74, 0.1); border-left: 4px solid #ff4a4a; padding: 12px; margin: 16px 0; border-radius: 4px;">
          <strong>Event:</strong> ${data.alertType.replace(/_/g, ' ')}<br/>
          <strong>Details:</strong> ${data.details}
        </div>
        <p style="color: #8e9a9e; font-size: 12px; margin-top: 24px;">
          If this wasn't you, please secure your account immediately or contact security support.
        </p>
      </div>
    `;

    try {
      if (data.email) {
        await emailProvider.sendEmail(data.email, subject, html);
      }
      if (data.mobile) {
        await smsProvider.sendSms(data.mobile, `⚠️ Vyra Security Alert: ${data.alertType.replace(/_/g, ' ')}. ${data.details}`);
      }
    } catch (err: any) {
      logger.error(`[NotificationService] Failed to send security alert: ${err.message}`);
    }
  }
}

export default new NotificationService();
