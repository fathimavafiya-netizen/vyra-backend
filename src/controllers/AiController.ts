import { Response, NextFunction } from 'express';
import aiService from '../services/AiService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class AiController {
  async generateCaption(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const imageUrl = req.body.imageUrl || req.body.mediaUrl;
      const { prompt } = req.body;

      if (!imageUrl && !prompt) {
        throw new Error('Either imageUrl or prompt is required');
      }

      // If we have an image, run visual captioning. Otherwise fallback to text prompt generator.
      const caption = imageUrl 
        ? await aiService.generateCaption(imageUrl)
        : `✨ Canned Caption for text prompt: "${prompt}". Created on Vyra 💫 #vibes`;

      return res.status(200).json({ success: true, caption });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async removeBackground(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const imageUrl = req.body.imageUrl || req.body.mediaUrl;
      const backgroundType = req.body.backgroundType || req.body.background || 'beach';

      if (!imageUrl) throw new Error('Image URL (imageUrl) is required');

      const jobId = await aiService.createJob(
        userId,
        'BACKGROUND_REPLACE',
        imageUrl,
        backgroundType
      );

      return res.status(202).json({
        success: true,
        jobId,
        status: 'PROCESSING',
        message: 'Background replacement job queued successfully'
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async applyFilter(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const imageUrl = req.body.imageUrl || req.body.mediaUrl;
      let style = req.body.style || req.body.filterType || 'anime';
      // Intercept legacy 'ghibli' filterType for backward compatibility
      // TODO: remove legacy 'ghibli' fallback mapping after client version v1.2.0 release
      if (style.toLowerCase() === 'ghibli') {
        style = 'anime';
      }

      if (!imageUrl) throw new Error('Image URL (imageUrl) is required');

      const jobId = await aiService.createJob(
        userId,
        'STYLE_TRANSFER',
        imageUrl,
        style
      );

      return res.status(202).json({
        success: true,
        jobId,
        status: 'PROCESSING',
        message: 'Style transfer job queued successfully'
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async generateHashtags(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { caption } = req.body;
      if (!caption) throw new Error('Caption text is required');

      const hashtags = await aiService.suggestHashtags(caption);
      return res.status(200).json({ success: true, hashtags });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async moderateContent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const imageUrl = req.body.imageUrl || req.body.mediaUrl;
      if (!imageUrl) throw new Error('Image URL (imageUrl) is required');

      const result = await aiService.moderateContent(imageUrl);
      return res.status(200).json({ success: true, ...result });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getJob(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const job = await aiService.getJob(id);
      if (!job) {
        return res.status(404).json({ success: false, message: 'AI Job not found' });
      }
      return res.status(200).json({ success: true, job });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const history = await aiService.getHistory(userId);
      return res.status(200).json({ success: true, history });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new AiController();
