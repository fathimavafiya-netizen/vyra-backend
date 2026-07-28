const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const post = await prisma.post.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { media: true, author: { include: { profile: true } } }
  });
  console.log(JSON.stringify(post, null, 2));
}

main().finally(() => prisma.$disconnect());
