import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import axios from 'axios';
import { createChildLogger } from '../logger/childLogger';

const log = createChildLogger('template_processor');

export interface TemplateCompileOptions {
  backgroundUrl: string;
  musicTrackUrl: string;
  text: string;
  themeColor: string;
}

class TemplateProcessor {
  /**
   * Downloads a remote file to a temporary location.
   */
  private async downloadFile(url: string, prefix: string, extension: string): Promise<string> {
    const tmpPath = path.join(os.tmpdir(), `vyra_${prefix}_${uuidv4()}${extension}`);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });
    
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tmpPath);
      response.data.pipe(writer);
      writer.on('finish', () => resolve(tmpPath));
      writer.on('error', reject);
    });
  }

  /**
   * Compiles a template into a 10s video.
   * Returns the path to the generated MP4 file.
   */
  public async compile(options: TemplateCompileOptions): Promise<string> {
    const { backgroundUrl, musicTrackUrl, text, themeColor } = options;
    const outputPath = path.join(os.tmpdir(), `vyra_template_${uuidv4()}.mp4`);
    
    let bgFile = '';
    let musicFile = '';
    
    try {
      log.info({ action: 'TEMPLATE_COMPILE_START' as any, options });

      // Download assets
      bgFile = await this.downloadFile(backgroundUrl, 'bg', '.jpg');
      musicFile = await this.downloadFile(musicTrackUrl, 'music', '.mp3');

      return await new Promise<string>((resolve, reject) => {
        const command = ffmpeg();
        
        // Input 1: The background image (looped)
        command.input(bgFile)
               .inputOptions(['-loop 1']);
               
        // Input 2: The music track
        command.input(musicFile);
        
        // Escape text for ffmpeg drawtext
        // Replacing single quotes and colons which cause issues
        const safeText = text.replace(/'/g, "\u2019").replace(/:/g, "\\:");

        // Create the filter graph
        // 1. Scale background to 720x1280 (vertical video)
        // 2. Add text overlay at the center
        // Note: For a real app, a custom font file is needed. We use the default font.
        const filterGraph = [
          `[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280[bg]`,
          `[bg]drawtext=text='${safeText}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5:boxborderw=10[v]`
        ].join(',');

        command
          .complexFilter(filterGraph, ['v'])
          .outputOptions([
            '-c:v libx264',
            '-preset veryfast',
            '-pix_fmt yuv420p',
            '-t 10', // 10 seconds duration
            '-c:a aac',
            '-b:a 128k',
            '-shortest' // Stop encoding when the shortest stream ends (10s image or audio)
          ])
          .output(outputPath)
          .on('end', () => {
            log.info({ action: 'TEMPLATE_COMPILE_SUCCESS' as any, outputPath });
            resolve(outputPath);
          })
          .on('error', (err) => {
            log.error({ action: 'TEMPLATE_COMPILE_ERROR' as any, error: err.message });
            reject(new Error('Failed to compile template: ' + err.message));
          });
          
        command.run();
      });
    } catch (err) {
      log.error({ action: 'TEMPLATE_COMPILE_FAIL' as any, error: (err as any).message });
      throw err;
    } finally {
      // Clean up downloaded assets
      if (bgFile && fs.existsSync(bgFile)) fs.unlinkSync(bgFile);
      if (musicFile && fs.existsSync(musicFile)) fs.unlinkSync(musicFile);
    }
  }
}

export default new TemplateProcessor();
