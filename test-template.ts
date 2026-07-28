import templateProcessor from './src/services/TemplateProcessor';
import path from 'path';

async function run() {
  try {
    const res = await templateProcessor.compile({
      backgroundUrl: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      musicTrackUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      text: 'Test Template',
      themeColor: '#FF0000'
    });
    console.log("Success:", res);
  } catch(e: any) {
    console.error("Error:", e.message);
  }
}
run();
