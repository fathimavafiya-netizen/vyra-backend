import { PrismaClient } from "@prisma/client";
import postService from "../services/PostService";
import postRepository from "../repositories/PostRepository";
import { formatPostResponse } from "../controllers/PostController";

const prisma = new PrismaClient();

async function runTests() {
  console.log("?? Starting Post Feature Verification tests...\n");

  // 1. Fetch or create a test user
  let user = await prisma.user.findFirst({
    include: { profile: true }
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: "posttester",
        email: "posttester@vyra.com",
        mobile: "9999999991",
        password: "mock-password",
        profile: {
          create: {
            name: "Post Tester",
            username: "posttester",
            bio: "Verification tester",
            profilePic: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
            coverPic: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e"
          }
        }
      },
      include: { profile: true }
    });
  }
  console.log(`?? Using user: ${user.username} (${user.id})`);

  // Fetch or create a second user (non-owner)
  let user2 = await prisma.user.findFirst({
    where: { NOT: { id: user.id } },
    include: { profile: true }
  });
  if (!user2) {
    user2 = await prisma.user.create({
      data: {
        username: "posttester2",
        email: "posttester2@vyra.com",
        mobile: "9999999992",
        password: "mock-password",
        profile: {
          create: {
            name: "Other Tester",
            username: "posttester2",
            bio: "Non-owner verification tester",
            profilePic: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
            coverPic: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e"
          }
        }
      },
      include: { profile: true }
    });
  }
  console.log(`?? Using non-owner: ${user2.username} (${user2.id})`);

  let testCasesRun = 0;
  let testCasesPassed = 0;

  // --- Test Case 1: Video Post <= 90s is Reels ---
  testCasesRun++;
  console.log("\n?? Test Case 1: Short Video (<= 90s) auto-classification");
  const shortVideoPost = await postService.createPost({
    userId: user.id,
    type: "VIDEO",
    caption: "Short loop #coding #fun",
    mediaUrl: "https://example.com/short.mp4",
    duration: 45,
  });
  console.log(`? Post created. Type: ${shortVideoPost.type}, Duration: ${shortVideoPost.duration}`);
  if (shortVideoPost.type === "REEL") {
    testCasesPassed++;
    console.log("?? Passed: duration 45s is classified as REEL");
  } else {
    throw new Error(`Failed: duration 45s classified as ${shortVideoPost.type} instead of REEL`);
  }

  // --- Test Case 2: Video Post > 90s is standard Video ---
  testCasesRun++;
  console.log("\n?? Test Case 2: Long Video (> 90s) auto-classification");
  const longVideoPost = await postService.createPost({
    userId: user.id,
    type: "VIDEO",
    caption: "Long documentary #nature #valley",
    mediaUrl: "https://example.com/long.mp4",
    duration: 120,
  });
  console.log(`? Post created. Type: ${longVideoPost.type}, Duration: ${longVideoPost.duration}`);
  if (longVideoPost.type === "VIDEO") {
    testCasesPassed++;
    console.log("?? Passed: duration 120s is classified as VIDEO");
  } else {
    throw new Error(`Failed: duration 120s classified as ${longVideoPost.type} instead of VIDEO`);
  }

  // --- Test Case 3: Hashtags normalization & duplicate elimination ---
  testCasesRun++;
  console.log("\n??? Test Case 3: Hashtag extraction and normalization");
  const hashtagPost = await postService.createPost({
    userId: user.id,
    type: "POST",
    caption: "Awesome day #Tech #tech #programming #Tech",
    mediaUrl: "https://example.com/tech.jpg"
  });
  // Fetch from DB to assert formatted hashtags relation
  const dbPost = await prisma.post.findUnique({
    where: { id: hashtagPost.id },
    include: { hashtags: { include: { hashtag: true } } }
  });
  const tags = dbPost?.hashtags.map(h => h.hashtag.name) || [];
  console.log("? Formatted tags in database:", tags);
  
  // Normalization checks
  if (tags.length === 2 && tags.includes("tech") && tags.includes("programming")) {
    testCasesPassed++;
    console.log("?? Passed: tags are lowercase, distinct, and duplicate-free");
  } else {
    throw new Error(`Failed: tag normalization drift. Extracted tags: ${tags.join(", ")}`);
  }

  // --- Test Case 4: Reposts creation and mapping ---
  testCasesRun++;
  console.log("\n?? Test Case 4: Repost creation and mapping");
  const repost = await postService.repost(shortVideoPost.id, user2.id, "Awesome repost loop");
  // Fetch through postRepository
  const fullRepost = await postRepository.findById(repost.id);
  const formatted = await formatPostResponse(fullRepost);
  console.log("? Formatted Repost:", JSON.stringify(formatted, null, 2));

  if (formatted.originalPost && formatted.originalPost._id === shortVideoPost.id) {
    testCasesPassed++;
    console.log("?? Passed: originalPost details correctly mapped and returned in response");
  } else {
    throw new Error("Failed: originalPost mapping empty or incorrect");
  }

  // --- Test Case 5: Authorization blocks non-owners from deletion ---
  testCasesRun++;
  console.log("\n??? Test Case 5: Deletion Authorization check");
  try {
    await postService.deletePost(shortVideoPost.id, user2.id); // user2 is NOT owner
    throw new Error("Failed: non-owner successfully deleted the post");
  } catch (err: any) {
    if (err.message.includes("Unauthorized") || err.message.includes("not found") || err.message.includes("not authorized")) {
      testCasesPassed++;
      console.log("?? Passed: unauthorized deletion blocked (correctly threw exception)");
    } else {
      throw err;
    }
  }

  // --- Test Case 6: Soft-delete filters from feeds ---
  testCasesRun++;
  console.log("\n??? Test Case 6: Soft-delete feed filtering");
  // Soft-delete the hashtag post
  await postService.deletePost(hashtagPost.id, user.id);
  
  // Try retrieving feed
  const feed = await postRepository.findFeed(user.id, {});
  const inFeed = feed.some(p => p.id === hashtagPost.id);
  
  // Check raw DB to ensure it still exists
  const rawDbPost = await prisma.post.findUnique({
    where: { id: hashtagPost.id }
  });

  if (!inFeed && rawDbPost && rawDbPost.deletedAt !== null) {
    testCasesPassed++;
    console.log("?? Passed: soft-deleted post excluded from feeds but remains in SQLite database");
  } else {
    throw new Error(`Failed: soft-delete filter mismatch. In feed: ${inFeed}, Raw DB exists: ${!!rawDbPost}`);
  }

  console.log(`\n?? Verification completed successfully: ${testCasesPassed}/${testCasesRun} tests passed!\n`);
}

runTests()
  .catch(err => {
    console.error("? Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
