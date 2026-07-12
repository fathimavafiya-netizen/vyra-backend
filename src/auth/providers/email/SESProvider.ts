import { EmailProvider } from './EmailProvider';
import logger from '../../../utils/logger';

export class SESProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    logger.info(`[SESProvider] Mock dispatching email: Subject="${subject}" to ${to}`);
    // Concrete AWS SES integrations go here when AWS keys are configured
    return true; 
  }
}

export default new SESProvider();
