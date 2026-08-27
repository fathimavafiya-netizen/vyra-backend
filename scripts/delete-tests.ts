import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ where: { OR: [{ fullName: { contains: 'Test' } }, { username: { contains: 'test' } }] } });
  const userIds = users.map(u => u.id);
  console.log('Found users:', users.map(u => u.fullName));
  
  if (userIds.length > 0) {
    console.log('Deleting media...');
    await prisma.media.deleteMany({ where: { userId: { in: userIds } } });
    console.log('Deleting stories...');
    await prisma.storyView.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.storyReaction.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.storyLike.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.storyReport.deleteMany({ where: { reporterId: { in: userIds } } });
    await prisma.story.deleteMany({ where: { userId: { in: userIds } } });
    console.log('Deleting comments and likes...');
    await prisma.comment.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.like.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.savedPost.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.postView.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: userIds } }, { reportedUserId: { in: userIds } }] } });
    console.log('Deleting posts...');
    await prisma.post.deleteMany({ where: { userId: { in: userIds } } });
    console.log('Deleting follows...');
    await prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: userIds } }, { followingId: { in: userIds } }] } });
    await prisma.followRequest.deleteMany({ where: { OR: [{ senderId: { in: userIds } }, { receiverId: { in: userIds } }] } });
    console.log('Deleting profiles and settings...');
    await prisma.profile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userSettings.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notificationPreferences.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { actorId: { in: userIds } }] } });
    console.log('Deleting users...');
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log('Done!');
  }
}
main().finally(() => prisma.$disconnect());
