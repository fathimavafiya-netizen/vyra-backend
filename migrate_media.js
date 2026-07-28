const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FALLBACK_IMAGE_URL = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
const FALLBACK_VIDEO_URL = 'https://res.cloudinary.com/demo/video/upload/dog.mp4';

async function migrate() {
  console.log('Starting media migration...');
  
  const allMedia = await prisma.media.findMany();
  for (const media of allMedia) {
    if (!media.url || 
        media.url.includes('localhost') || 
        media.url.includes('/uploads/') ||
        media.url.includes('googleapis') ||
        media.url.includes('unsplash')) {
      const newUrl = media.type === 'VIDEO' ? FALLBACK_VIDEO_URL : FALLBACK_IMAGE_URL;
      await prisma.media.update({
        where: { id: media.id },
        data: { url: newUrl }
      });
      console.log(`Updated media ${media.id} from ${media.url.substring(0, 30)}... to ${newUrl}`);
    }
  }

  console.log('Migration complete.');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
