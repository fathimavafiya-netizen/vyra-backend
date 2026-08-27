import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const initialUsers = await prisma.user.findMany();
  console.log(`Users before: ${initialUsers.length}`);

  const testAccounts = [];
  
  for (const user of initialUsers) {
    const email = (user.email || '').toLowerCase();
    
    if (email.includes('e2e_') && email.endsWith('@example.com')) {
      testAccounts.push(user.id);
    } else if (email.startsWith('test-') && email.endsWith('@example.com')) {
      testAccounts.push(user.id);
    } else if (email.startsWith('valid_login_') && email.endsWith('@example.com')) {
      testAccounts.push(user.id);
    } else if (email.startsWith('token_') && email.endsWith('@example.com')) {
      testAccounts.push(user.id);
    } else if (email.endsWith('@example.com') && /.*[0-9]{10,}.*@example\.com/.test(email)) {
      testAccounts.push(user.id);
    } else if (
      email.includes('user_a') || 
      email.includes('some_other_user') || 
      email.includes('notification')
    ) {
      testAccounts.push(user.id);
    }
  }

  console.log(`Users identified for deletion: ${testAccounts.length}`);

  if (testAccounts.length > 0) {
    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: { in: testAccounts }
      }
    });
    console.log(`Users deleted: ${deleteResult.count}`);
  } else {
    console.log(`Users deleted: 0`);
  }

  const finalUsers = await prisma.user.count();
  const finalPosts = await prisma.post.count();
  const finalStories = await prisma.story.count();

  console.log(`Users remaining: ${finalUsers}`);
  console.log(`Final Post count: ${finalPosts}`);
  console.log(`Final Story count: ${finalStories}`);
  
  const remainingUsersList = await prisma.user.findMany({ select: { username: true, email: true }});
  console.log('Remaining users:');
  remainingUsersList.forEach(u => console.log(`- ${u.username} (${u.email})`));
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
