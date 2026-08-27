const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const posts = await prisma.post.findMany({ where: { type: 'REEL' } });
  console.log(posts.length, 'REEL posts');
  console.log(posts.map(p => ({id: p.id, type: p.type})));
}
main().finally(() => prisma.$disconnect());
