import { queueManager } from './src/queue/queue';
import { handleVideoUpload } from './src/queue/MediaUploadQueue';
// Wait, handleVideoUpload is not exported. It's registered in the queue.
// Let's just create a job in the queue to trigger it.
import prisma from './src/config/db';
import { v4 as uuidv4 } from 'uuid';

async function run() {
  const jobId = uuidv4();
  await prisma.mediaUploadJob.create({
    data: {
      jobId,
      userId: 'test-user-id', // Needs to be a valid user ID though, let's find one
      status: 'QUEUED',
      mediaType: 'VIDEO',
      originalFilename: 'test.mp4',
      size: 1000
    }
  });
  console.log("Job created:", jobId);
}

run().finally(() => prisma.$disconnect());
