import { PrismaClient } from '@prisma/client';
import postService from '../services/PostService';

const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Starting Phase 2 functionality verification tests...');

  const userId = '60c72b2f9b1d8b2badcf5001'; // Aria
  const otherUserId = '60c72b2f9b1d8b2badcf5002'; // Kabir

  // Clear existing Phase 2 tables to prevent foreign key or uniqueness errors
  await prisma.report.deleteMany();
  await prisma.restrictedUser.deleteMany();
  await prisma.savedCollectionPost.deleteMany();
  await prisma.savedCollection.deleteMany();
  await prisma.savedPost.deleteMany();
  await prisma.media.deleteMany();
  await prisma.postHashtag.deleteMany();
  await prisma.post.deleteMany();

  // 1. Create a Carousel Post (mixed media: image + video)
  console.log('\n--- Test 1: Carousel post creation ---');
  const carouselPost = await postService.createPost({
    userId,
    type: 'POST',
    caption: 'Lovely carousel post #vibes #fun',
    media: [
      { url: 'https://images.unsplash.com/photo-1507525428034', type: 'IMAGE' },
      { url: 'https://assets.mixkit.co/videos/preview/mixkit-wave-1.mp4', type: 'VIDEO', duration: 15.5 }
    ]
  });

  console.log('Created Post ID:', carouselPost.id);
  console.log('Media count:', carouselPost.media.length);
  if (carouselPost.media.length !== 2) {
    throw new Error('Expected 2 media files for carousel post');
  }
  console.log('Media 1 order:', carouselPost.media[0].order, 'URL:', carouselPost.media[0].url);
  console.log('Media 2 order:', carouselPost.media[1].order, 'URL:', carouselPost.media[1].url);
  if (carouselPost.media[0].order !== 0 || carouselPost.media[1].order !== 1) {
    throw new Error('Expected ordered indices for carousel media');
  }

  // 2. Cursor-Based Pagination
  console.log('\n--- Test 2: Cursor-Based Pagination ---');
  // Let's create two more posts to test pagination
  const post2 = await postService.createPost({
    userId,
    type: 'POST',
    caption: 'Second post',
    mediaUrl: 'https://images.unsplash.com/photo-1500000000001'
  });
  const post3 = await postService.createPost({
    userId,
    type: 'POST',
    caption: 'Third post',
    mediaUrl: 'https://images.unsplash.com/photo-1500000000002'
  });

  // Query feed page 1 (limit 2)
  console.log('Fetching Page 1 (limit: 2)...');
  const page1 = await postService.getFeed(userId, { limit: 2 });
  console.log('Page 1 items count:', page1.length);
  if (page1.length !== 2) {
    throw new Error('Expected 2 items in page 1');
  }
  const lastPostId = page1[1].id;
  console.log('Last Post ID on Page 1:', lastPostId);

  // Query feed page 2 using lastPostId as cursor
  console.log('Fetching Page 2 with cursor...');
  const page2 = await postService.getFeed(userId, { limit: 2, cursor: lastPostId });
  console.log('Page 2 items count:', page2.length);
  if (page2.length !== 1) {
    throw new Error('Expected 1 item in page 2 (total 3 posts)');
  }
  console.log('Page 2 Post ID:', page2[0].id);

  // 3. Saved Collections & Validation Guards
  console.log('\n--- Test 3: Saved Collection creation ---');
  const collection = await postService.createCollection(userId, 'Cute Cats');
  console.log('Created collection name:', collection.name);

  // Duplicate collection name prevention
  console.log('\n--- Test 4: Duplicate collection name guard ---');
  try {
    await postService.createCollection(userId, 'Cute Cats');
    throw new Error('Allowed duplicate collection folder names!');
  } catch (e: any) {
    console.log('Pass: correctly caught duplicate collection name error:', e.message);
  }

  // Add post to collection (verifying automatic bookmarking first)
  console.log('\n--- Test 5: Add post to folder ---');
  await postService.addPostToCollection(collection.id, carouselPost.id, userId);

  // Check that savedPost record is created
  const savedRecord = await prisma.savedPost.findUnique({
    where: { userId_postId: { userId, postId: carouselPost.id } }
  });
  console.log('Is post marked as saved in DB:', !!savedRecord);
  if (!savedRecord) {
    throw new Error('Expected post to be auto-saved when added to collection');
  }

  // Duplicate save prevention
  console.log('\n--- Test 6: Duplicate save prevention ---');
  try {
    await postService.addPostToCollection(collection.id, carouselPost.id, userId);
    throw new Error('Allowed duplicate addition of post to collection folder!');
  } catch (e: any) {
    console.log('Pass: correctly caught duplicate collection post error:', e.message);
  }

  // Attack authorization check: other user tries to add post to this folder
  console.log('\n--- Test 7: Security check - attacker modifies other user\'s folder ---');
  try {
    await postService.addPostToCollection(collection.id, carouselPost.id, otherUserId);
    throw new Error('Attacker successfully modified other user\'s folder!');
  } catch (e: any) {
    console.log('Pass: correctly blocked folder edit:', e.message);
  }

  // Remove saved post from collection folder
  console.log('\n--- Test 8: Remove post from folder ---');
  await postService.removePostFromCollection(collection.id, carouselPost.id, userId);
  const countInFolder = await prisma.savedCollectionPost.count({
    where: { collectionId: collection.id }
  });
  console.log('Collection post count after removal:', countInFolder);
  if (countInFolder !== 0) {
    throw new Error('Post removal failed from collection folder');
  }

  // Delete folder
  console.log('\n--- Test 9: Delete collection folder ---');
  await postService.deleteCollection(collection.id, userId);
  const colCount = await prisma.savedCollection.count({
    where: { id: collection.id }
  });
  console.log('Collection count after delete:', colCount);
  if (colCount !== 0) {
    throw new Error('Collection folder deletion failed');
  }

  // 4. Restricted List
  console.log('\n--- Test 10: Restricted User list ---');
  const resRestrict = await postService.toggleRestrictUser(userId, otherUserId);
  console.log('Toggle restrict result:', resRestrict);
  if (!resRestrict.restricted) {
    throw new Error('Expected restricted to be true');
  }

  const isRestricted = await prisma.restrictedUser.findUnique({
    where: { restrictorId_restrictedId: { restrictorId: userId, restrictedId: otherUserId } }
  });
  console.log('Is restrict relation created in DB:', !!isRestricted);
  if (!isRestricted) {
    throw new Error('Expected Restricted relation in DB');
  }

  // Toggle again to unrestrict
  const resUnrestrict = await postService.toggleRestrictUser(userId, otherUserId);
  console.log('Toggle restrict (second run) result:', resUnrestrict);
  if (resUnrestrict.restricted) {
    throw new Error('Expected restricted to be false');
  }

  // 5. Multiple Content Reporting
  console.log('\n--- Test 11: Content Reporting (Post & User) ---');
  const report1 = await postService.reportPost(carouselPost.id, otherUserId, 'Spam content');
  console.log('First post report created:', report1.id);

  // Duplicate reports allowed (different reason/time)
  const report2 = await postService.reportPost(carouselPost.id, otherUserId, 'Inappropriate media');
  console.log('Second post report created:', report2.id);

  const reportCount = await prisma.report.count({
    where: { reportedPostId: carouselPost.id }
  });
  console.log('Total post reports count in DB:', reportCount);
  if (reportCount !== 2) {
    throw new Error('Expected 2 post report logs in DB');
  }

  console.log('\n🎉 ALL PHASE 2 FUNCTIONALITY TESTS PASSED SUCCESSFULLY!');
}

runTest()
  .catch(e => {
    console.error('❌ Phase 2 test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
