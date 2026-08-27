import { Response, NextFunction } from 'express';
import aiService from '../services/AiService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class AiController {
  async generateCaption(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const imageUrl = req.body.imageUrl || req.body.mediaUrl;
      const { prompt, tone, length } = req.body;

      if (!imageUrl && !prompt) {
        throw new Error('Either imageUrl or prompt is required');
      }

      let caption = '';

      if (imageUrl) {
        caption = await aiService.generateCaption(imageUrl);
      } else {
        // Construct a prompt string that AiService will treat as a text prompt
        const textPrompt = `Prompt: ${prompt}. Tone: ${tone || 'Casual'}. Length: ${length || 'Medium'}`;
        caption = await aiService.generateCaption(textPrompt);
      }

      return res.status(200).json({ success: true, data: { caption, hashtags: ['#sociall', '#ai'] } });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async generateTemplates(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { prompt, category, style } = req.body;
      if (!prompt) throw new Error('Prompt is required');
      
      // Since AiService doesn't have a template generator yet, we'll use the generateCaption as a base to get Gemini to output JSON for templates.
      const textPrompt = `Generate a JSON array of 3 social media template layouts for a ${category || 'Post'} about "${prompt}" in a ${style || 'Modern'} style. 
      Return ONLY a JSON array with objects containing these exact fields: id, title, description, suggestedColors (array of 2 hex codes), suggestedCaption, layoutType (string: split, overlay, minimal).`;
      
      const responseText = await aiService.generateCaption(textPrompt);
      
      let templates = [];
      try {
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        templates = JSON.parse(cleaned);
      } catch (err) {
        // Fallback if parsing fails
        templates = [
          {
            id: 'tmpl_1',
            title: `${style} ${category} Option 1`,
            description: `A clean, ${style} layout perfect for a ${category} about ${prompt}.`,
            suggestedColors: ['#FF5E3A', '#FF2A6D'],
            suggestedCaption: `Option 1: The best ${category} for ${prompt}! ✨`,
            layoutType: 'split'
          }
        ];
      }

      return res.status(200).json({ success: true, data: { templates } });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async generateScript(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { prompt } = req.body;
      if (!prompt) throw new Error('Prompt is required');
      const script = await aiService.generateScript(prompt);
      return res.status(200).json({ success: true, script });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async generateAvatar(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { prompt } = req.body;
      if (!prompt) throw new Error('Prompt is required');
      const avatarUrl = await aiService.generateAvatar(prompt);
      return res.status(200).json({ success: true, avatarUrl });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  }

  async generateVoiceover(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { text } = req.body;
      if (!text) throw new Error('Text is required');
      const audioUrl = await aiService.generateVoiceover(text);
      return res.status(200).json({ success: true, audioUrl });
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
      // Tracked in ISSUES.md (Issue #1): remove legacy 'ghibli' fallback mapping after client version v1.2.0 release
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
