import { SmsProvider } from './SmsProvider';
import logger from '../../../utils/logger';

export class SNSProvider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<boolean> {
    logger.info(`[SNSProvider] Mock dispatching SMS: to=${to}, body="${message}"`);
    return true; 
  }
}

export default new SNSProvider();
