import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { fullName: { contains: 'Test', mode: 'insensitive' } },
        { username: { contains: 'test', mode: 'insensitive' } },
        { email: { contains: 'test', mode: 'insensitive' } },
        { fullName: { contains: 'User A', mode: 'insensitive' } },
        { fullName: { contains: 'User B', mode: 'insensitive' } },
        { email: { contains: 'e2e', mode: 'insensitive' } },
      ]
    },
    select: { id: true, email: true, fullName: true }
  });

  console.log(`Found ${testUsers.length} test users to delete.`);

  for (const user of testUsers) {
    const userId = user.id;
    console.log(`Cleaning up User: ${user.fullName} (${user.email}) ID: ${userId}...`);

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
      console.log(` -> Deleted ${user.email}`);
    } catch (err) {
      console.error(`Failed to delete ${user.email}:`, err);
    }
  }

  console.log('Finished cleanup!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
