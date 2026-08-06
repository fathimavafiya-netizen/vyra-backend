import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running script to add mock video URLs for existing videos...');

  // Update a few existing posts to be REEL with a valid video URL
  const allPosts = await prisma.post.findMany({
    include: { media: true },
    take: 4,
    orderBy: { createdAt: 'desc' }
  });

  if (allPosts.length > 0) {
    // 1. Make the first one a REEL
    await prisma.post.update({
      where: { id: allPosts[0].id },
      data: { type: 'REEL', duration: 15 }
    });
    
    if (allPosts[0].media.length > 0) {
      await prisma.media.update({
        where: { id: allPosts[0].media[0].id },
        data: { 
          type: 'VIDEO', 
          url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
          duration: 15
        }
      });
    }

    // 2. Make the second one a VIDEO
    if (allPosts.length > 1) {
      await prisma.post.update({
        where: { id: allPosts[1].id },
        data: { type: 'VIDEO', duration: 60 }
      });
      
      if (allPosts[1].media.length > 0) {
        await prisma.media.update({
          where: { id: allPosts[1].media[0].id },
          data: { 
            type: 'VIDEO', 
            url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            duration: 60
          }
        });
      }
    }
    
    console.log('Successfully updated mock posts to be REEL and VIDEO with valid MP4 URLs!');
  } else {
    console.log('No posts found to update.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
