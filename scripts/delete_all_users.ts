import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching current user count...');
  const beforeCount = await prisma.user.count();
  console.log(`Users before deletion: ${beforeCount}`);

  console.log('Deleting all users (cascade enabled)...');
  const deleteResult = await prisma.user.deleteMany({});
  console.log(`Deleted ${deleteResult.count} users.`);

  console.log('Fetching post-deletion counts...');
  const afterCount = await prisma.user.count();
  const postCount = await prisma.post.count();
  const storyCount = await prisma.story.count();

  console.log(`Users remaining: ${afterCount}`);
  console.log(`Posts remaining: ${postCount}`);
  console.log(`Stories remaining: ${storyCount}`);

  if (afterCount === 0) {
    console.log('SUCCESS: All users successfully deleted.');
  } else {
    console.error('ERROR: Some users remain.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
