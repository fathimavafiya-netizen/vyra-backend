import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { id: true, fullName: true, username: true } });
  console.log(users.slice(0, 10));
}
main().catch(console.error).finally(() => prisma.$disconnect());
