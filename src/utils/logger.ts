import { logger as baseLogger } from '../logger/index';

// Export for backward compatibility with existing modules
export const childLogger = baseLogger;
export const logger = baseLogger;
export default baseLogger;
