const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all users...');
  
  try {
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`Successfully deleted ${deletedUsers.count} users.`);
    
    // Also delete any OTP records just to keep things clean
    const deletedOtps = await prisma.otpVerification.deleteMany({});
    console.log(`Successfully deleted ${deletedOtps.count} OTP records.`);
    
  } catch (error) {
    console.error('Error deleting users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
