import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running script to arrange short and long videos...');
  const res1 = await prisma.post.updateMany({
    where: { type: 'REEL', duration: { gt: 30 } },
    data: { type: 'VIDEO' }
  });
  console.log(`Updated ${res1.count} long videos from REEL to VIDEO.`);

  const res2 = await prisma.post.updateMany({
    where: { type: 'VIDEO', duration: { lte: 30 } },
    data: { type: 'REEL' }
  });
  console.log(`Updated ${res2.count} short videos from VIDEO to REEL.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
