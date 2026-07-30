import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = '9e86867f-3510-4b56-8dfe-11c1b12157ab'; // ID backed up from previous step

  console.log(`Starting transactional cleanup for Seeded E2E User (ID: ${userId})...`);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete user's media
      await tx.media.deleteMany({ where: { userId } });
      
      // 2. Delete user's stories and story interactions
      await tx.storyView.deleteMany({ where: { userId } });
      await tx.storyReaction.deleteMany({ where: { userId } });
      await tx.storyLike.deleteMany({ where: { userId } });
      await tx.storyReport.deleteMany({ where: { reporterId: userId } });
      await tx.story.deleteMany({ where: { userId } });
      
      // 3. Delete user's posts, comments, likes
      await tx.comment.deleteMany({ where: { userId } });
      await tx.like.deleteMany({ where: { userId } });
      await tx.savedPost.deleteMany({ where: { userId } });
      await tx.postView.deleteMany({ where: { userId } });
      await tx.report.deleteMany({ where: { OR: [{ reporterId: userId }, { reportedUserId: userId }] } });
      await tx.post.deleteMany({ where: { userId } });
      
      // 4. Delete user's follow interactions
      await tx.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
      await tx.followRequest.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
      
      // 5. Delete profile and settings
      await tx.profile.deleteMany({ where: { userId } });
      await tx.userSettings.deleteMany({ where: { userId } });
      await tx.notificationPreferences.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { OR: [{ userId: userId }, { actorId: userId }] } });
      
      // 6. Delete user
      await tx.user.delete({ where: { id: userId } });
    });

    console.log('Successfully completed database cleanup transaction.');
  } catch (err) {
    console.error('Transaction failed:', err);
    throw err;
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
