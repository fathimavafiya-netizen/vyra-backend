import { EmailProvider } from './EmailProvider';
import logger from '../../../utils/logger';
import { Resend } from 'resend';
import env from '../../../config/env';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export class ResendProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!resend) {
      logger.warn(`[ResendProvider] RESEND_API_KEY is not set. Outputting mail out-of-band: Subject="${subject}" to ${to}`);
      return true; // Simulating successful dev logging
    }

    try {
      const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
      const { error } = await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        html,
      });

      if (error) {
        logger.error(`[ResendProvider] Failed to dispatch email to ${to}: ${error.message}`);
        return false;
      }

      logger.info(`[ResendProvider] Email successfully sent to ${to}`);
      return true;
    } catch (err: any) {
      logger.error(`[ResendProvider] Exception during email delivery: ${err.message}`);
      return false;
    }
  }
}

export default new ResendProvider();
