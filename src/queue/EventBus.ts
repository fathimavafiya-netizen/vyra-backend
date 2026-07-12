import { pub, sub } from '../config/redis';
import logger from '../utils/logger';

export class EventBus {
  private handlers = new Map<string, Array<(payload: any) => Promise<void>>>();
  private initializedSub = false;

  constructor() {
    this.initSubscriber();
  }

  private initSubscriber() {
    if (this.initializedSub) return;
    this.initializedSub = true;

    // Set up global subscriber to receive message channels
    sub.on('message', async (channel: string, message: string) => {
      try {
        const payload = JSON.parse(message);
        logger.debug(`[EventBus] Received event [${channel}]`);
        const list = this.handlers.get(channel) || [];
        for (const handler of list) {
          await handler(payload).catch((err) => {
            logger.error(`[EventBus] Handler execution error on [${channel}]: ${err.message}`);
          });
        }
      } catch (err: any) {
        logger.error(`[EventBus] Subscriber parsing error on [${channel}]: ${err.message}`);
      }
    });
  }

  /**
   * Publishes an event to the message bus.
   * If Redis is scaled, this broadcasts the event to all server nodes automatically.
   */
  async publish(eventName: string, payload: any): Promise<void> {
    try {
      const message = JSON.stringify(payload);
      logger.debug(`[EventBus] Publishing event [${eventName}]`);
      await pub.publish(eventName, message);
    } catch (err: any) {
      logger.error(`[EventBus] Failed to publish event [${eventName}]: ${err.message}`);
    }
  }

  /**
   * Subscribes to events on the message bus.
   */
  async subscribe(eventName: string, handler: (payload: any) => Promise<void>): Promise<void> {
    try {
      if (!this.handlers.has(eventName)) {
        this.handlers.set(eventName, []);
        // Register connection channel in Redis
        await sub.subscribe(eventName);
      }
      this.handlers.get(eventName)!.push(handler);
      logger.debug(`[EventBus] Subscribed handler to event [${eventName}]`);
    } catch (err: any) {
      logger.error(`[EventBus] Failed to subscribe to [${eventName}]: ${err.message}`);
    }
  }
}

export default new EventBus();
