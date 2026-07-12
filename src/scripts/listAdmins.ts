import prisma from '../config/db';

async function main() {
  const users = await prisma.user.findMany({
    include: {
      profile: true
    }
  });

  console.log('--- ALL USERS ---');
  users.forEach(u => {
    console.log(`- Username: ${u.profile?.username}, Email: ${u.email}, Mobile: ${u.mobile}, Role: ${u.role}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
