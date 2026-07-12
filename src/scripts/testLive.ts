import prisma from '../config/db';

async function run() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No users found in database.');
    return;
  }
  console.log(`Using user: ${user.email || user.mobile} (${user.id})`);

  try {
    const title = "mental health";
    const channelName = `stream_${user.id}_${Date.now()}`;

    // Set any existing live streams by this host to inactive first
    await prisma.liveStream.updateMany({
      where: { hostId: user.id, isLive: true },
      data: { isLive: false },
    });

    console.log("Creating live stream...");
    const liveStream = await prisma.liveStream.create({
      data: {
        hostId: user.id,
        title,
        channelName,
        isLive: true,
        viewerCount: 0,
      },
      include: {
        host: {
          include: {
            profile: true,
          },
        },
      },
    });
    console.log("Live stream created successfully:", liveStream.id);

    console.log("Creating mock post...");
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        type: 'LIVE',
        caption: title,
      },
    });
    console.log("Mock post created successfully:", post.id);

  } catch (e: any) {
    console.error("Error during live start simulation:", e);
  }
}

run();
