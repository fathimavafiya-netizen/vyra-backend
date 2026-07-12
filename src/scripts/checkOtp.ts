import prisma from '../config/db';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'fathima.vafiya@lead.ac.in' },
    select: { id: true, email: true, passwordHash: true, updatedAt: true }
  });
  console.log('--- USER RESET STATUS ---');
  console.dir(user, { depth: null });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
