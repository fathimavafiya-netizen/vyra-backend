import { Request, Response } from 'express';
import FeatureFlagService from '../services/FeatureFlagService';

export const getFeatureFlags = async (req: Request, res: Response) => {
  try {
    const flags = await FeatureFlagService.getAllFlags();
    return res.status(200).json({ success: true, features: flags });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
