import prisma from '../config/db';

async function main() {
  console.log("--- STORIES SUMMARY ---");
  const stories = await prisma.story.findMany({
    include: {
      variants: true,
      user: { include: { profile: true } }
    }
  });
  console.log(`Total stories: ${stories.length}`);
  stories.forEach((s: any) => {
    console.log(`[STORY] ID: ${s.id}, User: ${s.user?.username || s.user?.profile?.name || 'unknown'}, Caption: "${s.caption}", Moderation: ${s.moderation}, Expiry: ${s.expiresAt}, DeleteReason: ${s.deleteReason}`);
    console.log(`  -> MediaUrl: ${s.mediaUrl}`);
    s.variants.forEach((v: any) => {
      console.log(`  -> Variant: Res: ${v.resolution}, URL: ${v.url}`);
    });
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
