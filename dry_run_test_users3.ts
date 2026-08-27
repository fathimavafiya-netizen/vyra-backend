import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: {
          posts: true,
          stories: true,
          comments: true,
          likes: true,
          followers: true,
          following: true,
        },
      },
    },
  });

  const totalUsers = users.length;
  console.log(`Current total users: ${totalUsers}`);
  console.log('---');

  const testAccounts = [];
  const unknownAccounts = [];

  for (const user of users) {
    let reason = null;
    const email = (user.email || '').toLowerCase();

    if (email.includes('e2e_') && email.endsWith('@example.com')) {
      reason = 'Matches e2e_*@example.com';
    } else if (email.startsWith('test-') && email.endsWith('@example.com')) {
      reason = 'Matches test-*@example.com';
    } else if (email.startsWith('valid_login_') && email.endsWith('@example.com')) {
      reason = 'Matches valid_login_*@example.com';
    } else if (email.startsWith('token_') && email.endsWith('@example.com')) {
      reason = 'Matches token_*@example.com';
    } else if (email.endsWith('@example.com') && /.*[0-9]{10,}.*@example\.com/.test(email)) {
      reason = 'Contains timestamp pattern in @example.com';
    } else if (
      email.includes('user_a') || 
      email.includes('some_other_user') || 
      email.includes('notification')
    ) {
        reason = 'Known demo/test account keyword';
    }

    if (reason) {
      testAccounts.push({ ...user, reason });
    } else {
      unknownAccounts.push(user);
    }
  }

  console.log(`Identified Test Accounts (${testAccounts.length}):`);
  testAccounts.forEach(t => {
    console.log(`- ${t.username} (${t.email})`);
    console.log(`  Reason: ${t.reason}`);
    console.log(`  Counts: Posts: ${t._count.posts}, Stories: ${t._count.stories}, Followers: ${t._count.followers}, Following: ${t._count.following}`);
  });

  console.log('\n---');
  console.log(`Unknown / Possibly Real Accounts (${unknownAccounts.length})`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
