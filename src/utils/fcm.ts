import adminPkg from 'firebase-admin';
import prisma from '../config/db';
import logger from './logger';

const admin: any = adminPkg;

let isFcmInitialized = false;

// Initialize Firebase Admin SDK
try {
  // Check if credentials env var is present
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    isFcmInitialized = true;
    logger.info('🔥 Firebase Admin SDK initialized successfully for FCM');
  } else {
    logger.info('ℹ️ Firebase credentials missing (GOOGLE_APPLICATION_CREDENTIALS). FCM operating in Mock log mode.');
  }
} catch (err: any) {
  logger.warn(`⚠️ Failed to initialize Firebase Admin SDK: ${err.message}. Operating in Mock mode.`);
}

export const fcm = {
  /**
   * Send a push notification to a specific user.
   * If the token is invalid or expired, it automatically removes it from the DB.
   */
  async sendPushToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, string>; channel: string }
  ): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true },
      });

      if (!user || !user.fcmToken) {
        logger.debug(`[FCM] Skip send: User ${userId} has no registered FCM token.`);
        return false;
      }

      const message: any = {
        token: user.fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          channel: payload.channel,
          ...(payload.data ?? {}),
        },
        android: {
          notification: {
            channelId: payload.channel.toLowerCase(),
          },
        },
        apns: {
          payload: {
            aps: {
              category: payload.channel.toLowerCase(),
            },
          },
        },
      };

      if (isFcmInitialized) {
        logger.debug(`[FCM] Dispatching push to ${userId}: "${payload.title}"`);
        await admin.messaging().send(message);
        return true;
      } else {
        // Canned simulation
        logger.info(`🤖 [FCM Mock] Push sent to user ${userId} (Token: ${user.fcmToken.slice(0, 10)}...): "${payload.title}" - "${payload.body}" [Channel: ${payload.channel}]`);
        return true;
      }
    } catch (err: any) {
      // Handle expired/invalid registration token errors
      const isBadToken =
        err.code === 'messaging/invalid-registration-token' ||
        err.code === 'messaging/registration-token-not-registered';

      if (isBadToken) {
        logger.warn(`⚠️ [FCM] Expired/Invalid token detected for user ${userId}. Clearing token from DB.`);
        try {
          await prisma.user.update({
            where: { id: userId },
            data: { fcmToken: null },
          });
        } catch (dbErr: any) {
          logger.error(`[FCM] Failed to clear invalid token for ${userId}: ${dbErr.message}`);
        }
      } else {
        logger.error(`[FCM] Send error for user ${userId}: ${err.message}`);
      }
      return false;
    }
  },
};

export default fcm;
