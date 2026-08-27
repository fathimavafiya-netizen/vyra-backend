import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  try {
    console.log('Connecting to Prisma...');
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('Query result:', result);

    const user = await prisma.user.findUnique({
      where: { email: 'aria@sociall.com' }
    });
    console.log('Test user:', user ? 'Found' : 'Not found');
  } catch (error) {
    console.error('Prisma Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
