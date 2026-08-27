import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkHealth() {
  console.log("Checking DB health...");
  try {
    const userCount = await prisma.user.count();
    const postCount = await prisma.post.count();
    const storyCount = await prisma.story.count();
    
    console.log(`DB is Healthy!`);
    console.log(`Current Users: ${userCount}`);
    console.log(`Current Posts: ${postCount}`);
    console.log(`Current Stories: ${storyCount}`);
  } catch (error) {
    console.error("DB Health Check Failed:", error);
  }
}

checkHealth().catch(console.error).finally(() => prisma.$disconnect());
