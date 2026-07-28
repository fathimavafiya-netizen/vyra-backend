import { PrismaClient } from '@prisma/client';
import { formatPostResponse } from './src/controllers/PostController';

const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.post.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { include: { profile: true } },
      media: true,
      hashtags: { include: { hashtag: true } },
      likes: true,
      comments: { include: { user: { include: { profile: true } } } },
      originalPost: {
        include: {
          user: { include: { profile: true } },
          media: true,
          hashtags: { include: { hashtag: true } },
          likes: true,
          comments: { include: { user: { include: { profile: true } } } },
        }
      }
    }
  });

  const formattedPosts = await Promise.all(posts.map(p => formatPostResponse(p)));
  
  const result = formattedPosts.map(post => ({
    id: post._id,
    caption: post.caption,
    mediaUrl: post.mediaUrl,
    media0: post.media?.[0]?.url,
    type: post.type,
  }));

  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
