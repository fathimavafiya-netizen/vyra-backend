import { Request, Response } from 'express';
import prisma from '../config/db';

export const getNotificationPreferences = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    let prefs = await prisma.notificationPreferences.findUnique({
      where: { userId }
    });

    if (!prefs) {
      prefs = await prisma.notificationPreferences.create({
        data: { userId }
      });
    }

    return res.status(200).json({ success: true, preferences: prefs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateNotificationPreferences = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const data = req.body;

  try {
    const prefs = await prisma.notificationPreferences.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data
      }
    });

    return res.status(200).json({ success: true, preferences: prefs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
