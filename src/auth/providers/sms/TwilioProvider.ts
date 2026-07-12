import { SmsProvider } from './SmsProvider';
import logger from '../../../utils/logger';
import twilio from 'twilio';

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export class TwilioProvider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<boolean> {
    if (!twilioClient) {
      logger.warn(`[TwilioProvider] Twilio API credentials missing. Printing SMS out-of-band: to=${to}, body="${message}"`);
      return true; // Simulating successful dev logging
    }

    try {
      const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890';
      const result = await twilioClient.messages.create({
        to,
        from: fromNumber,
        body: message,
      });

      logger.info(`[TwilioProvider] SMS successfully sent to ${to}: SID=${result.sid}`);
      return true;
    } catch (err: any) {
      logger.error(`[TwilioProvider] Exception during SMS delivery: ${err.message}`);
      return false;
    }
  }
}

export default new TwilioProvider();
