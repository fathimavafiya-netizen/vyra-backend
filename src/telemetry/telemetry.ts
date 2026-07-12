import logger from '../utils/logger';

export class TelemetryService {
  /**
   * Times execution duration of async functions and logs them
   */
  async trackLatency<T>(operationName: string, action: () => Promise<T>): Promise<T> {
    const start = process.hrtime();
    try {
      const result = await action();
      const diff = process.hrtime(start);
      const ms = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);

      logger.debug(`[Telemetry] Latency of "${operationName}": ${ms}ms`);
      return result;
    } catch (error: any) {
      const diff = process.hrtime(start);
      const ms = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);
      logger.error(`[Telemetry] Failed "${operationName}" after ${ms}ms: ${error.message}`);
      throw error;
    }
  }
}

export default new TelemetryService();
