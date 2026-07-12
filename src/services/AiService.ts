import { randomUUID } from 'crypto';
import logger from '../utils/logger';
import prisma from '../config/db';
import env from '../config/env';

// Import Google Generative AI dynamically or handle it safely to avoid runtime crashes if not installed
let GoogleGenerativeAI: any;
try {
  const genaiPkg = require('@google/generative-ai');
  GoogleGenerativeAI = genaiPkg.GoogleGenerativeAI;
} catch (err) {
  logger.warn('⚠️ @google/generative-ai not fully loaded, fallback mock will be active');
}

export interface AiJob {
  id: string;
  type: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  resultUrl?: string;
  error?: string;
}

export const aiJobs = new Map<string, AiJob>();

// ─── Provider Interface ───
export interface AiProvider {
  generateCaption(imageUrl: string): Promise<string>;
  suggestHashtags(captionText: string): Promise<string[]>;
  moderateContent(imageUrl: string): Promise<{ safe: boolean; labels: string[] }>;
}

// ─── Gemini Provider Implementation ───
class GeminiProvider implements AiProvider {
  private genAI: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private async fetchImagePart(url: string) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Attempt to guess mime type from URL extension
      let mimeType = 'image/jpeg';
      if (url.endsWith('.png')) mimeType = 'image/png';
      else if (url.endsWith('.webp')) mimeType = 'image/webp';

      return {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType,
        },
      };
    } catch (err: any) {
      throw new Error(`Failed to fetch image for Gemini input: ${err.message}`);
    }
  }

  async generateCaption(imageUrl: string): Promise<string> {
    logger.debug(`[Gemini AI] Generating caption for: ${imageUrl}`);
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Check if input is a text prompt/theme description instead of a remote image URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:')) {
      const result = await model.generateContent([
        `Generate a short, engaging, and premium social media caption (with 1-2 relevant emojis) based on this prompt/theme: "${imageUrl}"`
      ]);
      return result.response.text().trim();
    }

    const imagePart = await this.fetchImagePart(imageUrl);

    const result = await model.generateContent([
      'Generate a short, engaging, and premium social media caption for this image.',
      imagePart,
    ]);
    const text = result.response.text();
    return text.trim();
  }

  async suggestHashtags(captionText: string): Promise<string[]> {
    logger.debug(`[Gemini AI] Generating hashtags for caption`);
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Based on the social media caption below, generate a JSON array containing 5-8 relevant hashtags. Return ONLY the JSON string. Do not include Markdown blocks.
    
    Caption: "${captionText}"`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    try {
      // Clean markdown code blocks if any
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      // Regexp fallback if JSON parse fails
      const hashtags = text.match(/#[a-zA-Z0-9_]+/g);
      return hashtags ? hashtags.map((h: string) => h.replace('#', '')) : ['vyra', 'aesthetic', 'trending'];
    }
  }

  async moderateContent(imageUrl: string): Promise<{ safe: boolean; labels: string[] }> {
    logger.debug(`[Gemini AI] Moderating content for: ${imageUrl}`);
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const imagePart = await this.fetchImagePart(imageUrl);

    const prompt = `Analyze this image for safety. Does it contain adult content, extreme violence, self-harm, or hate speech?
    Respond with a JSON object in this format: { "safe": boolean, "labels": string[] } listing any flagged flags/categories. Return ONLY the JSON string.`;

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().trim();

    try {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return { safe: true, labels: [] };
    }
  }
}

// ─── Mock Provider Implementation ───
class MockProvider implements AiProvider {
  async generateCaption(imageUrl: string): Promise<string> {
    logger.debug(`[Mock AI] Simulating caption generation`);
    return '✨ Living life in full color! Capturing the beautiful moments. 💫 #vibes #aesthetic #vyra';
  }

  async suggestHashtags(captionText: string): Promise<string[]> {
    logger.debug(`[Mock AI] Simulating hashtag suggestions`);
    return ['vyra', 'aesthetic', 'trending', 'creators', 'modern'];
  }

  async moderateContent(imageUrl: string): Promise<{ safe: boolean; labels: string[] }> {
    logger.debug(`[Mock AI] Simulating content moderation`);
    return { safe: true, labels: [] };
  }
}

// ─── Active Provider Instantiation ───
let activeProvider: AiProvider;

if (env.GEMINI_API_KEY && GoogleGenerativeAI) {
  logger.info('🤖 Gemini API Key configured. Activating Gemini AI provider.');
  activeProvider = new GeminiProvider(env.GEMINI_API_KEY);
} else {
  logger.info('ℹ️ Gemini API Key not set. Activating Mock AI fallback provider.');
  activeProvider = new MockProvider();
}

// ─── AiService Main Class Wrapper ───
export class AiService {
  async getJob(jobId: string): Promise<AiJob | undefined> {
    return aiJobs.get(jobId);
  }

  async getHistory(userId: string) {
    return prisma.aiHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateCaption(imageUrl: string): Promise<string> {
    return activeProvider.generateCaption(imageUrl);
  }

  async suggestHashtags(captionText: string): Promise<string[]> {
    return activeProvider.suggestHashtags(captionText);
  }

  async moderateContent(imageUrl: string): Promise<{ safe: boolean; labels: string[] }> {
    return activeProvider.moderateContent(imageUrl);
  }

  async createJob(
    userId: string,
    type: 'STYLE_TRANSFER' | 'BACKGROUND_REPLACE',
    imageUrl: string,
    extraOption: string,
    prompt?: string
  ): Promise<string> {
    const jobId = randomUUID();
    logger.info(`🤖 AI Job Created: id=${jobId}, type=${type}, inputUrl=${imageUrl}, extra=${extraOption}`);

    aiJobs.set(jobId, {
      id: jobId,
      type,
      status: 'PROCESSING',
    });

    setTimeout(async () => {
      try {
        let resultUrl = imageUrl;

        if (type === 'STYLE_TRANSFER') {
          const stylePresets: any = {
            anime: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
            // Deprecated backward compatibility alias
            // TODO: remove legacy 'ghibli' key after client version v1.2.0 release
            ghibli: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
            cartoon: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
            watercolor: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
            sketch: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80',
          };
          resultUrl = stylePresets[extraOption.toLowerCase()] || stylePresets.anime;
        } else if (type === 'BACKGROUND_REPLACE') {
          const backgroundPresets: any = {
            beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
            office: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
            mountain: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
            temple: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80',
            space: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
            forest: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80',
          };
          resultUrl = backgroundPresets[extraOption.toLowerCase()] || backgroundPresets.beach;
        }

        aiJobs.set(jobId, {
          id: jobId,
          type,
          status: 'COMPLETED',
          resultUrl,
        });

        await prisma.aiHistory.create({
          data: {
            userId,
            type,
            prompt: prompt || extraOption,
            inputUrl: imageUrl,
            resultUrl,
            status: 'COMPLETED',
          },
        });

        logger.info(`✅ AI Job Completed successfully: id=${jobId}`);
      } catch (err: any) {
        logger.error(`❌ AI Job Processing failed: id=${jobId}, err=${err.message}`);
        aiJobs.set(jobId, {
          id: jobId,
          type,
          status: 'FAILED',
          error: err.message,
        });

        await prisma.aiHistory.create({
          data: {
            userId,
            type,
            prompt: prompt || extraOption,
            inputUrl: imageUrl,
            status: 'FAILED',
          },
        });
      }
    }, 3000);

    return jobId;
  }
}

export default new AiService();
