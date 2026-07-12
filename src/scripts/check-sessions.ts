import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      profile: true,
      sessions: true,
    }
  });
  console.log("--- USERS & SESSIONS ---");
  for (const u of users) {
    console.log(`User: ${u.username || u.email || u.mobile} (ID: ${u.id})`);
    console.log(`  Profile Name: ${u.profile?.name}`);
    console.log(`  Sessions count: ${u.sessions.length}`);
    for (const s of u.sessions) {
      console.log(`    Session ID: ${s.id}, Valid: ${s.isValid}, Expires: ${s.expiresAt}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
