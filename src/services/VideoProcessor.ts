import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../logger/childLogger';

const log = createChildLogger('video_processor');

export interface VideoManifest {
  trimStart?: number;
  trimEnd?: number;
  speed?: string | number; // Support '2.0x' or 2.0
  filter?: string;
  audio?: string;
  textOverlay?: string;
}

export class VideoProcessor {
  /**
   * Processes a video file according to the edit manifest
   * @param inputPath Path to the raw video
   * @param manifest Video manifest containing edit params
   * @returns Path to the processed video file
   */
  public async processVideo(inputPath: string, manifest: VideoManifest): Promise<string> {
    return new Promise((resolve, reject) => {
      // 1. Validate and Parse Manifest
      let { trimStart, trimEnd, speed, filter, textOverlay } = manifest;
      
      trimStart = typeof trimStart === 'number' ? Math.max(0, trimStart) : undefined;
      trimEnd = typeof trimEnd === 'number' ? trimEnd : undefined;
      if (trimStart !== undefined && trimEnd !== undefined && trimEnd <= trimStart) {
        trimEnd = undefined; // Invalid trim range, ignore
      }

      let speedFactor = 1.0;
      if (typeof speed === 'string') {
        speedFactor = parseFloat(speed.replace('x', ''));
      } else if (typeof speed === 'number') {
        speedFactor = speed;
      }
      if (isNaN(speedFactor) || speedFactor <= 0.1 || speedFactor > 5.0) {
        speedFactor = 1.0; // clamp to safe limits
      }

      // Generate unique temp file
      const outputPath = path.join(os.tmpdir(), `sociall-processed-video-${uuidv4()}.mp4`);
      
      const command = ffmpeg(inputPath);
      
      // 2. Apply Trim
      if (trimStart !== undefined) {
        command.setStartTime(trimStart);
      }
      if (trimEnd !== undefined && trimStart !== undefined) {
        command.setDuration(trimEnd - trimStart);
      }

      const videoFilters: string[] = [];
      const audioFilters: string[] = [];

      // 3. Apply Speed
      if (speedFactor !== 1.0) {
        // video speed: setpts
        videoFilters.push(`setpts=${1 / speedFactor}*PTS`);
        // audio speed: atempo (has limits 0.5 to 2.0 per filter, may need stacking for extreme speeds, but keeping it simple)
        let atempo = speedFactor;
        if (atempo < 0.5) atempo = 0.5;
        if (atempo > 2.0) atempo = 2.0;
        audioFilters.push(`atempo=${atempo}`);
      }

      // 4. Apply Visual Filters
      if (filter) {
        switch (filter) {
          case 'cyberpunk':
            videoFilters.push('colorchannelmixer=rr=2:bb=2:gg=0');
            break;
          case 'vintage':
            videoFilters.push('colorchannelmixer=rr=0.5:gg=0.4:bb=0.3,eq=saturation=0.5:contrast=1.2');
            break;
          case 'normal':
          default:
            break;
        }
      }

      // 5. Apply Text Overlay
      if (textOverlay && textOverlay.trim() !== '') {
        // Safe string escaping for ffmpeg drawtext
        const safeText = textOverlay.replace(/'/g, "\\'").replace(/:/g, '\\:');
        videoFilters.push(`drawtext=text='${safeText}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=h-th-50:box=1:boxcolor=black@0.5:boxborderw=10`);
      }

      // Add combined filters
      if (videoFilters.length > 0) {
        command.videoFilters(videoFilters);
      }
      if (audioFilters.length > 0) {
        command.audioFilters(audioFilters);
      }

      // 6. Execute FFmpeg
      command
        .outputOptions([
          '-movflags faststart', // optimize for web streaming
          '-pix_fmt yuv420p'     // ensure wide compatibility
        ])
        .on('start', (cmd) => {
          log.debug({ action: 'FFMPEG_START' as any, command: cmd });
        })
        .on('error', (err) => {
          log.error({ action: 'FFMPEG_ERROR' as any, error: err.message });
          reject(new Error(`Video processing failed: ${err.message}`));
        })
        .on('end', () => {
          log.info({ action: 'FFMPEG_COMPLETE' as any, outputPath });
          resolve(outputPath);
        })
        .save(outputPath);
    });
  }
}

export default new VideoProcessor();
