import prisma from '../config/db';
import { generateAccessToken } from '../utils/jwt';
import logger from '../utils/logger';

// Make sure queues are imported
import '../queue/MediaProcessingQueue';

async function test() {
  console.log('🚀 Starting Story Creation End-to-End API Test...');

  // 1. Get test user
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in database!');
    return;
  }
  console.log(`Using User: ${user.id} (${user.email})`);

  // 2. Generate access token
  const token = generateAccessToken(user.id, 'USER', 'session_abc_123', 1);
  console.log('Generated auth token successfully.');

  // 3. Make POST request to http://localhost:5000/api/v1/stories
  const payload = {
    caption: 'Blossoms E2E remote fetch test!',
    mediaUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    mediaType: 'IMAGE',
    visibility: 'PUBLIC'
  };

  console.log('Sending POST /api/v1/stories request...');
  const res = await fetch('http://localhost:5000/api/v1/stories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  console.log(`HTTP Status: ${res.status}`);
  const data = await res.json() as any;
  console.log('API Response:', data);

  if (!data.success) {
    console.error('❌ FAILURE: API returned failure response.');
    return;
  }

  const storyId = data.storyId;
  console.log(`Pending story created with ID: ${storyId}`);

  // 4. Wait for processing (4 seconds)
  console.log('Waiting 4 seconds for media processing queue job to download, scan, resize, and approve...');
  await new Promise(resolve => setTimeout(resolve, 4000));

  // 5. Query story details and variants
  const updatedStory = await prisma.story.findUnique({
    where: { id: storyId },
    include: { variants: true }
  });

  if (!updatedStory) {
    console.error('❌ FAILURE: Story not found in database after wait!');
    return;
  }

  console.log(`Story Moderation Status: ${updatedStory.moderation}`);
  console.log(`Story Variants Count: ${updatedStory.variants.length}`);

  if (updatedStory.variants.length > 0) {
    console.log('Story Variants Details:');
    updatedStory.variants.forEach((v, index) => {
      console.log(`  [${index}] resolution=${v.resolution} url=${v.url}`);
    });
  }

  if (updatedStory.moderation === 'APPROVED' && updatedStory.variants.length === 5) {
    console.log('✅ SUCCESS: Story successfully posted, processed, and approved end-to-end!');
  } else {
    console.error('❌ FAILURE: Story processing did not result in APPROVED status or incorrect variants.');
  }

  // 6. Clean up
  await prisma.storyMediaVariant.deleteMany({ where: { storyId } });
  await prisma.story.delete({ where: { id: storyId } });
  console.log('🧹 Cleanup complete.');
}

test()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
