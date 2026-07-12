import prisma from '../config/db';

async function run() {
  try {
    const streams = await prisma.liveStream.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log("Current Live Streams in DB:");
    streams.forEach(s => {
      console.log(`- ID: ${s.id} | Title: "${s.title}" | HostID: ${s.hostId} | isLive: ${s.isLive} | CreatedAt: ${s.createdAt}`);
    });
  } catch (e: any) {
    console.error(e);
  }
}

run();
