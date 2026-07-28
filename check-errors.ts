import prisma from './src/config/db';

async function run() {
  const jobs = await prisma.mediaUploadJob.findMany({
    where: { status: 'FAILED' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Recent Failed Jobs:");
  jobs.forEach(j => console.log(j.jobId, j.errorMessage));
}
run().finally(() => prisma.$disconnect());
