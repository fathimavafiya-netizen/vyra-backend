const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ include: { profile: true } });
  
  const toDelete = users.filter(u => {
    const name = (u.profile?.name || '').toLowerCase();
    const username = (u.profile?.username || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes('test') || name.includes('demo') || 
           username.includes('test') || username.includes('demo') ||
           email.includes('test') || email.includes('demo');
  });

  console.log(`Found ${toDelete.length} users to delete.`);
  for (const user of toDelete) {
    console.log(`Deleting ${user.email} (name: ${user.profile?.name})`);
    // Delete related records manually if cascade is not set, but prisma usually handles this if schema is setup with onDelete: Cascade
    // Just to be safe, let's try a direct delete
    try {
      await prisma.user.delete({ where: { id: user.id } });
    } catch (e) {
      console.log(`Failed to delete ${user.email}:`, e.message);
    }
  }

  // Also delete test tags
  const tags = await prisma.hashtag.findMany();
  const tagsToDelete = tags.filter(t => t.name.startsWith('some_'));
  for (const tag of tagsToDelete) {
    try {
      await prisma.hashtag.delete({ where: { id: tag.id } });
      console.log(`Deleted tag: ${tag.name}`);
    } catch (e) {}
  }
}

main().finally(() => prisma.$disconnect());
