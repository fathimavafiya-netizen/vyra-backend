import { SmsProvider } from './SmsProvider';
import logger from '../../../utils/logger';

export class MSG91Provider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<boolean> {
    logger.info(`[MSG91Provider] Mock dispatching SMS: to=${to}, body="${message}"`);
    return true; 
  }
}

export default new MSG91Provider();
