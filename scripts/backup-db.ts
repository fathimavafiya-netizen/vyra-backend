import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching Seeded E2E User...');
  
  const e2eUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'e2e@example.com' },
        { profile: { name: { contains: 'E2E' } } },
        { profile: { name: { contains: 'Seeded' } } }
      ]
    },
    include: {
      profile: true,
      posts: true,
      stories: true,
      media: true,
      likes: true,
      comments: true
    }
  });

  if (!e2eUser) {
    console.log('No E2E user found matching criteria.');
    return;
  }

  console.log(`Found user: ${e2eUser.profile?.name} (ID: ${e2eUser.id})`);

  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `e2e-user-backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(e2eUser, null, 2));
  
  console.log(`Successfully backed up user and related data to ${backupFile}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
