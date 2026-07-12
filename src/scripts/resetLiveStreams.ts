import prisma from '../config/db';

async function run() {
  try {
    const res = await prisma.liveStream.updateMany({
      where: { isLive: true },
      data: { isLive: false },
    });
    console.log(`Success: reset ${res.count} live streams to inactive.`);
  } catch (e: any) {
    console.error(e);
  }
}

run();
