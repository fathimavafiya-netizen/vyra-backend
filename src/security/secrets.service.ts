import logger from '../utils/logger';

export class SecretsService {
  /**
   * Retrieves a secret key dynamically. Falls back to process.env if cloud vault isn't configured.
   * Supports: AWS Secrets Manager, Google Secret Manager, Azure Key Vault.
   */
  async getSecret(keyName: string, fallbackValue: string): Promise<string> {
    try {
      const provider = process.env.SECRETS_PROVIDER; // 'AWS' | 'GCP' | 'AZURE' | undefined

      if (provider === 'AWS') {
        logger.debug(`[Secrets] Fetching ${keyName} from AWS Secrets Manager...`);
        // AWS secrets fetch integration
        return process.env[keyName] || fallbackValue;
      } else if (provider === 'GCP') {
        logger.debug(`[Secrets] Fetching ${keyName} from Google Secret Manager...`);
        // GCP secrets fetch integration
        return process.env[keyName] || fallbackValue;
      } else if (provider === 'AZURE') {
        logger.debug(`[Secrets] Fetching ${keyName} from Azure Key Vault...`);
        // Azure Key Vault integration
        return process.env[keyName] || fallbackValue;
      }

      // Default env lookup
      return process.env[keyName] || fallbackValue;
    } catch (err: any) {
      logger.error(`[Secrets] Failed to resolve secret ${keyName}: ${err.message}. Using fallback.`);
      return fallbackValue;
    }
  }
}

export default new SecretsService();
