import logger from '../utils/logger';

// Store metrics in memory
const metricsStore = new Map<string, number>();

// Initialize default metric counters
const defaultMetrics = [
  'login_success',
  'login_failed',
  'otp_generated',
  'otp_failed',
  'otp_verified',
  'otp_expired',
  'replay_attacks',
  'refresh_rotated',
  'active_sessions',
  'socket_connections',
];

defaultMetrics.forEach((m) => metricsStore.set(m, 0));

export class MetricsService {
  incrementMetric(name: string, count = 1) {
    const current = metricsStore.get(name) || 0;
    metricsStore.set(name, current + count);
    logger.debug(`[Metrics] Increment "${name}" -> ${current + count}`);
  }

  setMetric(name: string, value: number) {
    metricsStore.set(name, value);
    logger.debug(`[Metrics] Set "${name}" -> ${value}`);
  }

  getMetric(name: string): number {
    return metricsStore.get(name) || 0;
  }

  /**
   * Generates standard Prometheus exposition text format
   */
  getPrometheusMetrics(): string {
    let output = '';
    for (const [key, value] of metricsStore.entries()) {
      output += `# HELP vyra_${key} Current count of ${key.replace(/_/g, ' ')}\n`;
      output += `# TYPE vyra_${key} counter\n`;
      output += `vyra_${key} ${value}\n\n`;
    }
    return output;
  }
}

export default new MetricsService();
