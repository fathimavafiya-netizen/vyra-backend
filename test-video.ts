import path from 'path';
import VideoProcessor from './src/services/VideoProcessor';
import fs from 'fs';

async function run() {
  try {
    const res = await VideoProcessor.processVideo('C:\\Windows\\Media\\chimes.wav', { speed: 1, filter: 'cyberpunk', textOverlay: 'Neon Text' });
    console.log("Success:", res);
  } catch(e: any) {
    console.error("Error:", e.message);
  }
}
run();
