import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { fullName: { contains: 'Test', mode: 'insensitive' } },
        { username: { contains: 'test', mode: 'insensitive' } },
        { email: { contains: 'test', mode: 'insensitive' } },
        { fullName: { contains: 'User A', mode: 'insensitive' } },
        { fullName: { contains: 'User B', mode: 'insensitive' } },
        { email: { contains: 'e2e', mode: 'insensitive' } },
      ]
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true
    }
  });

  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
