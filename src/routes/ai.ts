import { Router } from 'express';
import aiController from '../controllers/AiController';
import aiService from '../services/AiService';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/caption', aiController.generateCaption);
router.post('/background', aiController.removeBackground);
router.post('/filter', aiController.applyFilter);
router.post('/hashtags', aiController.generateHashtags);
router.post('/moderate', aiController.moderateContent);

// AI Jobs & History Endpoints
router.get('/job/:id', aiController.getJob);
router.get('/history', aiController.getHistory);

// Client Compatibility Aliases
router.post('/background-replace', aiController.removeBackground);
router.post('/style-transfer', aiController.applyFilter);
router.post('/generate-metadata', async (req, res) => {
  try {
    const prompt = req.body.prompt || '';
    const mediaType = req.body.mediaType || 'post';
    const caption = await aiService.generateCaption(prompt);
    const hashtagsList = await aiService.suggestHashtags(prompt);
    const hashtags = hashtagsList.map((h: string) => `#${h}`); // prefix with # for client
    
    return res.status(200).json({
      success: true,
      data: {
        caption,
        hashtags,
        description: `AI generated description for ${mediaType} about "${prompt}".`,
      }
    });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
});

export default router;
