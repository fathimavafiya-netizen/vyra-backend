import { EmailProvider } from './EmailProvider';
import logger from '../../../utils/logger';

export class SendGridProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    logger.info(`[SendGridProvider] Mock dispatching email: Subject="${subject}" to ${to}`);
    // Concrete SendGrid integrations go here when SENDGRID_API_KEY is configured
    return true; 
  }
}

export default new SendGridProvider();
