const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.post.count({
    where: { isHidden: false, deletedAt: null }
  });
  console.log(`Current posts count: ${count}`);
  
  if (count < 15) {
    console.log('Seeding additional posts for E2E tests...');
    // Find a user to assign the posts to
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No user found to assign posts to.');
      return;
    }
    
    const postsData = [];
    for (let i = 0; i < 15; i++) {
      postsData.push({
        userId: user.id,
        caption: `E2E Test Post Number ${i} ${Date.now()}`,
        type: 'POST',
        status: 'PUBLISHED',
        isHidden: false,
      });
    }
    
    await prisma.post.createMany({ data: postsData });
    console.log('Successfully seeded 15 posts.');
  }
}

main()
  .catch(e => {
    console.error('Error seeding posts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
