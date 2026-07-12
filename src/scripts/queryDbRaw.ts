import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- DB SUMMARY ---");
  const posts = await prisma.post.findMany({
    where: { deletedAt: null },
    include: { media: true, originalPost: { include: { media: true } } }
  });
  console.log(`Total active posts: ${posts.length}`);
  posts.forEach((p: any) => {
    console.log(`[POST] ID: ${p.id}, Caption: "${p.caption}", Type: ${p.type}, OriginalPostId: ${p.originalPostId}`);
    p.media.forEach((m: any) => {
      console.log(`  -> Media: URL: ${m.url}, Type: ${m.type}`);
    });
    if (p.originalPost) {
      console.log(`  -> OriginalPost Caption: "${p.originalPost.caption}"`);
      p.originalPost.media.forEach((m: any) => {
        console.log(`     -> OriginalMedia URL: ${m.url}`);
      });
    }
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
