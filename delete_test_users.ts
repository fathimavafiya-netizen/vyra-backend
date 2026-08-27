import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SEED_EMAILS = [
  'aria@sociall.com',
  'kabir@sociall.com',
  'zara@sociall.com',
  'rohan@sociall.com',
  'elena@sociall.com',
  'vikram@sociall.com',
  'maya@sociall.com',
  'arjun@sociall.com',
  'meera@sociall.com',
  'dev@sociall.com'
];

async function executeDeletion() {
  console.log("Fetching all users before deletion...");
  const allUsersBefore = await prisma.user.findMany({ select: { id: true, email: true } });
  
  // Find accounts that match our criteria
  const targetUserIds = allUsersBefore.filter(u => {
    const email = u.email || '';
    return SEED_EMAILS.includes(email) || email.match(/^(e2e|test).*@example\.com$/);
  }).map(u => u.id);

  console.log(`Found ${targetUserIds.length} users matching criteria.`);
  
  if (targetUserIds.length > 0) {
    console.log("Deleting users...");
    // Prisma deleteMany
    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: { in: targetUserIds }
      }
    });
    console.log(`Successfully deleted ${deleteResult.count} users.`);
  }

  // Verification
  console.log("Fetching all users after deletion...");
  const allUsersAfter = await prisma.user.findMany({ select: { id: true, email: true } });
  
  const remainingTargets = allUsersAfter.filter(u => {
    const email = u.email || '';
    return SEED_EMAILS.includes(email) || email.match(/^(e2e|test).*@example\.com$/);
  });

  console.log(`\n--- VERIFICATION ---`);
  console.log(`Total users before: ${allUsersBefore.length}`);
  console.log(`Total users deleted: ${targetUserIds.length}`);
  console.log(`Total users after: ${allUsersAfter.length}`);
  console.log(`Expected users after: ${allUsersBefore.length - targetUserIds.length}`);
  console.log(`Remaining confirmed test accounts: ${remainingTargets.length}`);
  if (remainingTargets.length > 0) {
    console.log("WARNING: Some test accounts remain:", remainingTargets.map(u => u.email));
  } else {
    console.log("SUCCESS: All test accounts successfully purged.");
  }
}

executeDeletion().catch(console.error).finally(() => prisma.$disconnect());
