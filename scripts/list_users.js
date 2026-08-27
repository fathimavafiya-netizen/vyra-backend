const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      NOT: [
        { email: { endsWith: '@example.com' } },
        { email: { endsWith: '@sociall.com' } }
      ]
    },
    select: { email: true }
  });
  console.log(users);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
