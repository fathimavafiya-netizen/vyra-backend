const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stories = await prisma.story.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Stories:', JSON.stringify(stories, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
