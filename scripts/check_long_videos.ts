import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const posts = await prisma.post.findMany({ where: { type: 'long_video' } });
  console.log('Remaining long videos:', posts.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
