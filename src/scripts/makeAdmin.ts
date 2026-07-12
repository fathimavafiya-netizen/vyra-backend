import prisma from '../config/db';
import { UserRole } from '../config/constants';

async function run() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('❌ Usage: npx ts-node src/scripts/makeAdmin.ts <email_or_username>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: arg },
          { profile: { username: arg } },
        ],
      },
    });

    if (!user) {
      console.error(`❌ User not found with email or username: "${arg}"`);
      process.exit(1);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
      include: { profile: true },
    });

    console.log(`✅ Success! User "${updated.profile?.username}" (${updated.email}) promoted to ADMIN.`);
    process.exit(0);
  } catch (err: any) {
    console.error(`❌ Database error: ${err.message}`);
    process.exit(1);
  }
}

run();
