import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function run() {
  const email = 'vafiya@gmail.com';
  const rawPassword = 'Vafiya@1234';
  const username = 'vafiya';
  const fullName = 'Vafiya';

  try {
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Update existing user to ADMIN and set the password
      const updated = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: passwordHash,
          passwordHash: passwordHash,
          role: 'ADMIN',
          isVerified: true,
          profile: {
            upsert: {
              create: { name: fullName, username },
              update: { name: fullName, username },
            },
          },
        },
        include: { profile: true },
      });
      console.log(`✅ Success! Existing user updated and promoted: "${updated.profile?.username}" (${updated.email}) is now ADMIN with the new password.`);
    } else {
      // Check if username is already taken
      const usernameExists = await prisma.profile.findUnique({
        where: { username },
      });
      const uniqueUsername = usernameExists ? `${username}_admin` : username;

      // Create new ADMIN user
      const user = await prisma.user.create({
        data: {
          email,
          password: passwordHash,
          passwordHash: passwordHash,
          fullName,
          username: uniqueUsername,
          provider: 'credentials',
          emailVerified: true,
          isVerified: true,
          role: 'ADMIN',
          emailVerifiedAt: new Date(),
          consentGivenAt: new Date(),
          privacyVersion: '1.0',
          termsVersion: '1.0',
          profile: {
            create: {
              name: fullName,
              username: uniqueUsername,
            },
          },
          settings: {
            create: {},
          },
        },
        include: { profile: true },
      });
      console.log(`✅ Success! Created new ADMIN user: "${user.profile?.username}" (${user.email}).`);
    }

    process.exit(0);
  } catch (err: any) {
    console.error(`❌ Error setting up admin: ${err.message}`);
    process.exit(1);
  }
}

run();
