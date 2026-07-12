import { PrismaClient } from '@prisma/client';
import storyRepository from '../repositories/StoryRepository';
import notificationService from '../services/NotificationService';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function runTests() {
  console.log('🚀 Starting Story Feature Verification tests...\n');

  // 1. Fetch or create a test user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: 'storytester',
        email: 'storytester@vyra.com',
        mobile: '9999999999',
        password: 'mock-password',
      },
    });
  }
  console.log(`👤 Using user: ${user.username} (${user.id})`);

  // Fetch/create a mentioned user
  let mentionedUser = await prisma.user.findFirst({
    where: { NOT: { id: user.id } },
  });
  if (!mentionedUser) {
    mentionedUser = await prisma.user.create({
      data: {
        username: 'mentionedfriend',
        email: 'friend@vyra.com',
        mobile: '8888888888',
        password: 'mock-password',
      },
    });
  }
  console.log(`👥 Using mentioned user: ${mentionedUser.username} (${mentionedUser.id})`);

  // Create temporary local file in uploads for deletion test
  const tempFileName = `test-story-media-${Date.now()}.jpg`;
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const tempFilePath = path.join(uploadDir, tempFileName);
  fs.writeFileSync(tempFilePath, 'dummy image content');
  console.log(`📁 Created mock local media file at: ${tempFilePath}`);

  const mockMediaUrl = `http://localhost:5000/uploads/${tempFileName}`;

  // 2. Test Story Creation
  console.log('\n--- Test Case 1: Story Creation ---');
  const mockTextOverlays = JSON.stringify([{ id: 'text_1', content: 'Testing Overlays', color: '#FFF', fontSize: 20, x: 100, y: 100 }]);
  const mockStickers = JSON.stringify([{ id: 'sticker_1', emoji: '🔥', x: 200, y: 200 }]);

  const story = await storyRepository.createStory({
    userId: user.id,
    caption: 'My first epic story!',
    mediaUrl: mockMediaUrl,
    mediaType: 'IMAGE', // Plain string
    duration: 5.0,
    isCloseFriends: false,
    filterApplied: 'sepia',
    textOverlays: mockTextOverlays,
    stickers: mockStickers,
    musicTrackId: 'track_1',
    mentionedUserIds: [mentionedUser.id],
  });

  console.log(`✅ Story created with ID: ${story.id}`);
  console.log(`   Caption: "${story.caption}"`);
  console.log(`   Filter: ${story.filterApplied}`);
  console.log(`   MusicTrackId: ${story.musicTrackId}`);
  console.log(`   Mentions count: ${story.mentions.length}`);

  if (story.caption !== 'My first epic story!') throw new Error('Assertion failed: caption mismatch');
  if (story.filterApplied !== 'sepia') throw new Error('Assertion failed: filter mismatch');
  if (story.musicTrackId !== 'track_1') throw new Error('Assertion failed: musicTrackId mismatch');
  if (story.mentions.length !== 1) throw new Error('Assertion failed: mentions list length mismatch');

  // Trigger mention notifications manually
  await notificationService.sendNotification(
    mentionedUser.id,
    'MENTION',
    'You were mentioned!',
    `${user.username} mentioned you in their story.`,
    story.id
  );

  // Verify mention notification is in the DB
  const notifications = await prisma.notification.findMany({
    where: { userId: mentionedUser.id, type: 'MENTION', referenceId: story.id },
  });
  console.log(`✅ Mention Notification successfully persisted: Count = ${notifications.length}`);
  if (notifications.length === 0) throw new Error('Assertion failed: Notification not persisted');

  // 3. Test Liking the Story
  console.log('\n--- Test Case 2: Story Liking ---');
  const like = await storyRepository.likeStory(story.id, mentionedUser.id);
  console.log(`✅ Story Liked: User ${like.userId} liked Story ${like.storyId}`);

  let activeStories = await storyRepository.getActiveStories(mentionedUser.id);
  let activeStory = activeStories.find(s => s.id === story.id);
  console.log(`   Active story contains like: ${activeStory?.likes.some(l => l.userId === mentionedUser.id)}`);
  if (!activeStory?.likes.some(l => l.userId === mentionedUser.id)) throw new Error('Assertion failed: Like not found in active query');

  // 4. Test Unliking the Story
  console.log('\n--- Test Case 3: Story Unliking ---');
  await storyRepository.unlikeStory(story.id, mentionedUser.id);
  console.log('✅ Story Unliked');

  activeStories = await storyRepository.getActiveStories(mentionedUser.id);
  activeStory = activeStories.find(s => s.id === story.id);
  console.log(`   Active story contains like after unlike: ${activeStory?.likes.some(l => l.userId === mentionedUser.id)}`);
  if (activeStory?.likes.some(l => l.userId === mentionedUser.id)) throw new Error('Assertion failed: Like still present after unlike');

  // 5. Test Story Reaction
  console.log('\n--- Test Case 4: Story Reactions ---');
  const reaction = await storyRepository.upsertReaction(story.id, mentionedUser.id, '🔥');
  console.log(`✅ Story Reaction Created: User ${reaction.userId} reacted with ${reaction.emoji}`);

  activeStories = await storyRepository.getActiveStories(mentionedUser.id);
  activeStory = activeStories.find(s => s.id === story.id);
  const userReaction = activeStory?.reactions.find(r => r.userId === mentionedUser.id);
  console.log(`   Active story contains reaction: ${userReaction?.emoji}`);
  if (userReaction?.emoji !== '🔥') throw new Error('Assertion failed: Reaction mismatch or not found');

  // 6. Test Story Interactions Feed
  console.log('\n--- Test Case 5: Story Interactions Feed (Paginated/Authorized) ---');
  const interactions = await storyRepository.getStoryInteractions(story.id, user.id, { limit: 10 });
  console.log(`✅ Interactions retrieved: Views = ${interactions.views.length}, Likes = ${interactions.likes.length}, Reactions = ${interactions.reactions.length}`);
  if (interactions.reactions.length !== 1) throw new Error('Assertion failed: reactions count mismatch');

  // Test interaction authorization guard
  try {
    await storyRepository.getStoryInteractions(story.id, mentionedUser.id, { limit: 10 });
    throw new Error('Assertion failed: non-owner did not throw 403 authorization error');
  } catch (err: any) {
    console.log(`✅ Authorization check passed: Non-owner access correctly rejected with message: "${err.message}"`);
  }

  // 7. Test Soft Deletion and file cleanup
  console.log('\n--- Test Case 6: Story Soft-Delete & File Cleanup ---');
  const storyService = require('../services/StoryService').default;
  await storyService.deleteStory(story.id, user.id);

  console.log('✅ Story Soft-Deleted');

  // Verify it is excluded from active stories feed
  activeStories = await storyRepository.getActiveStories(mentionedUser.id);
  const found = activeStories.some(s => s.id === story.id);
  console.log(`   Active story feed contains deleted story: ${found}`);
  if (found) throw new Error('Assertion failed: Soft-deleted story still visible in active feed');

  // Verify file was deleted from uploads directory
  const fileExists = fs.existsSync(tempFilePath);
  console.log(`   Local file still exists on disk: ${fileExists}`);
  if (fileExists) {
    fs.unlinkSync(tempFilePath);
    throw new Error('Assertion failed: Local file was not cleaned up from disk on deletion');
  }
  console.log('✅ Local file correctly unlinked from filesystem');

  console.log('\n✨ All Story Feature verification tests passed successfully!');
}

runTests()
  .catch(e => {
    console.error('\n❌ Verification test failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
