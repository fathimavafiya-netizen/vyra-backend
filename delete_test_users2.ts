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
  const allUsersBefore = await prisma.user.findMany({ select: { id: true, email: true, username: true, fullName: true, createdAt: true } });
  
  const targetUserIds = allUsersBefore.filter(u => {
    const email = u.email || '';
    const fullName = u.fullName || '';
    const isSeed = SEED_EMAILS.includes(email);
    const isE2E = email.match(/^(e2e|test).*@example\.com$/) || email.includes('playwright');
    const isTestName = fullName.includes('Valid Login') || fullName.includes('Token Test');
    return isSeed || isE2E || (isTestName && email.includes('example.com')); // extra safe check for test names
  }).map(u => u.id);

  console.log(`Found ${targetUserIds.length} users matching criteria.`);
  
  if (targetUserIds.length > 0) {
    console.log("Deleting users...");
    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: { in: targetUserIds }
      }
    });
    console.log(`Successfully deleted ${deleteResult.count} users.`);
  }

  // Verification
  console.log("Fetching all users after deletion...");
  const allUsersAfter = await prisma.user.findMany({ select: { id: true, email: true, username: true, fullName: true, createdAt: true } });
  
  const remainingTargets = allUsersAfter.filter(u => {
    const email = u.email || '';
    const fullName = u.fullName || '';
    const isSeed = SEED_EMAILS.includes(email);
    const isE2E = email.match(/^(e2e|test).*@example\.com$/) || email.includes('playwright');
    const isTestName = fullName.includes('Valid Login') || fullName.includes('Token Test');
    return isSeed || isE2E || (isTestName && email.includes('example.com')); // extra safe check for test names
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

  // Final Health Check
  console.log("\n--- DB HEALTH CHECK ---");
  const userCount = await prisma.user.count();
  const postCount = await prisma.post.count();
  const storyCount = await prisma.story.count();
  console.log(`DB is Healthy!`);
  console.log(`Current Users: ${userCount}`);
  console.log(`Current Posts: ${postCount}`);
  console.log(`Current Stories: ${storyCount}`);
}

executeDeletion().catch(console.error).finally(() => prisma.$disconnect());
