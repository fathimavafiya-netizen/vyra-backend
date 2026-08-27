import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.post.findMany({
    where: {
      type: 'REEL'
    },
    include: {
      user: true,
      media: true
    }
  });

  console.log(`Found ${posts.length} Reels in the database.`);
  posts.forEach(post => {
    console.log(`\nReel ID: ${post.id}`);
    console.log(`User: ${post.user?.username}`);
    console.log(`Caption: ${post.caption}`);
    console.log(`Media Items: ${post.media?.length || 0}`);
    if (post.media) {
      post.media.forEach((m, idx) => {
        console.log(`  [${idx}] URL: ${m.url}, Type: ${m.type}`);
      });
    }
  });

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
