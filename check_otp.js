const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const otps = await prisma.otpVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log(JSON.stringify(otps, null, 2));
}
main().finally(() => prisma.$disconnect());
