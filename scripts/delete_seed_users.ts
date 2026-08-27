import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.user.deleteMany({
    where: {
      email: {
        endsWith: '@sociall.com',
      }
    }
  });
  console.log(`Deleted ${result.count} seed test users.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
