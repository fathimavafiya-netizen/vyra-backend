import prisma from './src/config/db';

async function test() {
  const cleanQuery = 'flowe';
  const searchWord = 'flowe';
  const where: any = { type: { not: 'STORY' } };
  where.OR = [
    { caption: { contains: cleanQuery, mode: 'insensitive' } },
    { caption: { contains: searchWord, mode: 'insensitive' } },
    { hashtags: { some: { hashtag: { name: { contains: searchWord, mode: 'insensitive' } } } } },
    { user: { profile: { name: { contains: searchWord, mode: 'insensitive' } } } },
    { user: { profile: { username: { contains: searchWord, mode: 'insensitive' } } } },
  ];
  const posts = await prisma.post.findMany({
    where,
    take: 20,
  });
  console.log('Posts count:', posts.length);
  console.log('Unique Posts count:', new Set(posts.map(p => p.id)).size);
}
test().catch(console.error).finally(() => process.exit(0));
