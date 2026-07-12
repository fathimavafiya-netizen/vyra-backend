import redisClient from '../config/redis';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

export interface Job {
  id: string;
  type: string;
  payload: any;
  priority: 'high' | 'medium' | 'low';
  attempts: number;
  createdAt: number;
}

type JobHandler = (payload: any) => Promise<boolean>;

class QueueManager {
  private handlers = new Map<string, JobHandler>();
  private localQueue: Job[] = [];
  private isProcessing = false;

  constructor() {
    // Start processing queue loop
    setInterval(() => {
      this.processNextJobs().catch(err => {
        logger.error(`Error in queue processing loop: ${err.message}`);
      });
    }, 1000);
  }

  /**
   * Registers a worker handler for a specific job type
   */
  registerWorker(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
    logger.info(`[Queue] Worker registered for job type: ${type}`);
  }

  /**
   * Enqueues a new background job with a specified priority
   */
  async addJob(type: string, payload: any, priority: 'high' | 'medium' | 'low' = 'medium', attempts = 0) {
    const job: Job = {
      id: randomUUID(),
      type,
      payload,
      priority,
      attempts,
      createdAt: Date.now(),
    };

    try {
      const isRealRedis = (redisClient as any).status === 'ready' && (redisClient as any).constructor?.name !== 'MockRedis';

      if (isRealRedis) {
        // Enqueue to Redis priority lists
        const redisKey = `queue:jobs:${priority}`;
        await redisClient.rpush(redisKey, JSON.stringify(job));
      } else {
        // Fallback to local memory priority sorting
        this.localQueue.push(job);
        this.localQueue.sort((a, b) => {
          const priorityWeight = { high: 3, medium: 2, low: 1 };
          return priorityWeight[b.priority] - priorityWeight[a.priority];
        });
      }
      logger.debug(`[Queue] Added job [${job.id}] type=${type} priority=${priority} attempts=${attempts}`);
    } catch (err: any) {
      logger.error(`[Queue] Failed to add job: ${err.message}`);
      // Fail-open: push locally
      this.localQueue.push(job);
    }
  }

  /**
   * Process pending jobs in order of priority (High -> Medium -> Low)
   */
  private async processNextJobs() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const isRealRedis = (redisClient as any).status === 'ready' && (redisClient as any).constructor?.name !== 'MockRedis';

      if (isRealRedis) {
        // Check priorities sequentially
        const priorities: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];
        for (const prio of priorities) {
          const redisKey = `queue:jobs:${prio}`;
          const rawJob = await redisClient.lpop(redisKey);
          if (rawJob) {
            const job: Job = JSON.parse(rawJob);
            await this.executeJob(job);
            break; // Process one job at a time
          }
        }
      } else {
        // Local queue processing
        if (this.localQueue.length > 0) {
          const job = this.localQueue.shift();
          if (job) {
            await this.executeJob(job);
          }
        }
      }
    } catch (err: any) {
      logger.error(`[Queue] Error processing job: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeJob(job: Job) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      logger.error(`[Queue] No handler registered for job type: ${job.type}`);
      return;
    }

    try {
      job.attempts++;
      const success = await handler(job.payload);
      if (success) {
        logger.debug(`[Queue] Job [${job.id}] completed successfully`);
      } else {
        await this.handleJobFailure(job, new Error('Handler returned false status'));
      }
    } catch (err: any) {
      await this.handleJobFailure(job, err);
    }
  }

  private async handleJobFailure(job: Job, err: any) {
    logger.warn(`[Queue] Job [${job.id}] failed (Attempt ${job.attempts}): ${err.message}`);

    if (job.attempts < 3) {
      // Re-enqueue for retry
      logger.info(`[Queue] Re-enqueuing job [${job.id}] for retry`);
      await this.addJob(job.type, job.payload, job.priority, job.attempts);
    } else {
      logger.error(`[Queue] Job [${job.id}] exceeded max retries. Permanently failed.`);
      
      // Update story DB status on permanent failure
      if (job.type === 'media_processing') {
        const { storyId, userId } = job.payload;
        try {
          const prisma = require('../config/db').default;
          const eventBus = require('./EventBus').default;
          await prisma.story.update({
            where: { id: storyId },
            data: { moderation: 'BLOCKED', deleteReason: `Media processing exceeded max retries: ${err.message}` }
          });
          await eventBus.publish('story.moderated', { storyId, userId, status: 'BLOCKED' });
        } catch (dbErr: any) {
          logger.error(`[Queue] Failed to mark story as blocked on max retries: ${dbErr.message}`);
        }
      }
    }
  }
}

export const queueManager = new QueueManager();
export default queueManager;
