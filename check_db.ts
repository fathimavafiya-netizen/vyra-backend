import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const posts = await prisma.post.count();
  const stories = await prisma.story.count();

  console.log('Final Users:', users);
  console.log('Final Posts:', posts);
  console.log('Final Stories:', stories);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
