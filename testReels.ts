const storyController = require('./src/controllers/StoryController').default;
const mockReq = {
  user: { id: '00000000-0000-0000-0000-000000000000' }, // any valid user id? Wait, I need a valid user id, or it might fail?
  query: {}
};
const mockRes = {
  json: (data) => console.log('res.json', JSON.stringify(data, null, 2))
};
const mockNext = (e) => console.log('next error:', e);

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst();
  if (!user) return console.log('no user');
  mockReq.user.id = user.id;

  await storyController.getReelsFeed(mockReq, mockRes, mockNext);
  await prisma.$disconnect();
}
main();
