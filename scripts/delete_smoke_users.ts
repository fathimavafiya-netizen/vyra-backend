import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.user.deleteMany({
    where: {
      OR: [
        { username: { startsWith: 'smoketest_' } },
        { email: { startsWith: 'smoke_' } }
      ]
    }
  });
  console.log(`Deleted ${deleted.count} smoke test users`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
