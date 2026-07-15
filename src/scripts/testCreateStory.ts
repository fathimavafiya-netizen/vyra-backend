import prisma from '../config/db';
import queueManager from '../queue/queue';
import fs from 'fs';
import path from 'path';

// Import queues to register them
import '../queue/MediaProcessingQueue';

async function test() {
  console.log('🚀 Running E2E Story Creation Queue Test...');

  // 1. Get a test user
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in database!');
    return;
  }
  console.log(`Using User: ${user.id}`);

  // 2. Create story in DB
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const story = await prisma.story.create({
    data: {
      userId: user.id,
      caption: 'Integration test story',
      expiresAt,
      visibility: 'PUBLIC',
      moderation: 'PENDING'
    }
  });
  console.log(`Created PENDING story: ${story.id}`);

  // 3. Add job to queue
  console.log('Adding media_processing job to queue...');
  await queueManager.addJob('media_processing', {
    storyId: story.id,
    userId: user.id,
    mediaUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    originalName: 'test-story-image.jpg',
    mimeType: 'image/jpeg',
    caption: 'Integration test story'
  }, 'high');

  // 4. Wait for job processing
  console.log('Waiting for background processing (3 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 5. Verify story status
  const updatedStory = await prisma.story.findUnique({
    where: { id: story.id },
    include: { variants: true }
  });

  if (!updatedStory) {
    console.error('Story was deleted or not found!');
    return;
  }

  console.log(`Updated Story Status: ${updatedStory.moderation}`);
  console.log(`Updated Story Variants Count: ${updatedStory.variants.length}`);

  if (updatedStory.moderation === 'APPROVED' && updatedStory.variants.length > 0) {
    console.log('✅ SUCCESS: Story successfully processed and approved by queue!');
  } else {
    console.error('❌ FAILURE: Story moderation status or variants incorrect.');
  }

  // 6. Clean up
  await prisma.storyMediaVariant.deleteMany({ where: { storyId: story.id } });
  await prisma.story.delete({ where: { id: story.id } });
  console.log('🧹 Cleanup complete.');
}

test()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
