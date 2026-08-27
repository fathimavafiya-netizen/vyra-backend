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

async function dryRun() {
  console.log("Fetching all users for dry-run...");
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, username: true, fullName: true, createdAt: true } });
  
  const targetUsers = allUsers.filter(u => {
    const email = u.email || '';
    const fullName = u.fullName || '';
    const isSeed = SEED_EMAILS.includes(email);
    const isE2E = email.match(/^(e2e|test).*@example\.com$/) || email.includes('playwright');
    const isTestName = fullName.includes('Valid Login') || fullName.includes('Token Test');
    return isSeed || isE2E || (isTestName && email.includes('example.com')); // extra safe check for test names
  });

  console.log(`\n--- DRY RUN RESULTS ---`);
  console.log(`Total users in database: ${allUsers.length}`);
  console.log(`Test/Demo users found: ${targetUsers.length}`);
  console.log(`\nAccounts to be deleted:`);
  targetUsers.forEach(u => {
    console.log(`- ID: ${u.id}, Email: ${u.email}, Username: ${u.username}, Name: ${u.fullName}`);
  });
}

dryRun().catch(console.error).finally(() => prisma.$disconnect());
