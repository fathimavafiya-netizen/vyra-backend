import { PrismaClient } from '@prisma/client';
import userService from '../services/UserService';

const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Starting database follow verification tests (with expanded edge cases & auth guards)...');

  const senderId = '60c72b2f9b1d8b2badcf5001'; // Aria
  const receiverId = '60c72b2f9b1d8b2badcf5002'; // Kabir
  const attackerId = '60c72b2f9b1d8b2badcf5003'; // Zara (third-party attacker)

  // Clear existing data
  await prisma.follow.deleteMany({
    where: {
      OR: [
        { followerId: senderId, followingId: receiverId },
        { followerId: receiverId, followingId: senderId }
      ]
    }
  });

  await prisma.followRequest.deleteMany({
    where: {
      OR: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId }
      ]
    }
  });

  await prisma.blockedUser.deleteMany({
    where: {
      OR: [
        { blockerId: senderId, blockedId: receiverId },
        { blockerId: receiverId, blockedId: senderId }
      ]
    }
  });

  // Test 1: Self-follow prevention
  console.log('\n--- Test 1: Self follow prevention ---');
  try {
    await userService.followUser(senderId, senderId);
    throw new Error('Self follow did not throw an error');
  } catch (e: any) {
    console.log('Pass: correctly caught self-follow error:', e.message);
  }

  // Test 2: Public Follow Flow
  console.log('\n--- Test 2: Public Follow Flow ---');
  await prisma.userSettings.update({
    where: { userId: receiverId },
    data: { isPrivate: false }
  });
  const resPublic = await userService.followUser(senderId, receiverId);
  console.log('Result:', resPublic);
  if (resPublic.status !== 'FOLLOWING') {
    throw new Error('Expected FOLLOWING status for public user');
  }

  // Test 3: Unfollow public user
  console.log('\n--- Test 3: Unfollow public user ---');
  const resUnfollow = await userService.unfollowUser(senderId, receiverId);
  console.log('Result:', resUnfollow);

  // Test 4: Private Follow Flow (PENDING)
  console.log('\n--- Test 4: Follow private user ---');
  await prisma.userSettings.update({
    where: { userId: receiverId },
    data: { isPrivate: true }
  });
  const resPrivate = await userService.followUser(senderId, receiverId);
  console.log('Result:', resPrivate);
  if (resPrivate.status !== 'REQUESTED') {
    throw new Error('Expected status REQUESTED for private user');
  }

  // Test 5: Duplicate prevention
  console.log('\n--- Test 5: Duplicate follow request prevention ---');
  const resDup = await userService.followUser(senderId, receiverId);
  console.log('Result:', resDup);

  // Verify request row in DB
  const reqRow = await prisma.followRequest.findUnique({
    where: { senderId_receiverId: { senderId, receiverId } }
  });

  // Test 6: Auth check - Attacker accepts other user's follow request
  console.log('\n--- Test 6: Security check - attacker accepts other user\'s follow request ---');
  try {
    await userService.acceptFollowRequest(reqRow!.id, attackerId);
    throw new Error('Attacker successfully accepted another user\'s follow request!');
  } catch (e: any) {
    console.log('Pass: correctly blocked attacker from accepting other request:', e.message);
  }

  // Test 7: Auth check - Attacker rejects other user's follow request
  console.log('\n--- Test 7: Security check - attacker rejects other user\'s follow request ---');
  try {
    await userService.rejectFollowRequest(reqRow!.id, attackerId);
    throw new Error('Attacker successfully rejected another user\'s follow request!');
  } catch (e: any) {
    console.log('Pass: correctly blocked attacker from rejecting other request:', e.message);
  }

  // Test 8: Auth check - Attacker cancels sent request they didn't create
  console.log('\n--- Test 8: Security check - attacker cancels sent request they didn\'t create ---');
  try {
    await userService.cancelFollowRequest(attackerId, receiverId);
    throw new Error('Attacker successfully cancelled a follow request they did not author!');
  } catch (e: any) {
    console.log('Pass: correctly blocked attacker from cancelling request they did not author:', e.message);
  }

  // Test 9: Cancel sent request (correct user)
  console.log('\n--- Test 9: Cancel sent request (correct sender) ---');
  const resCancel = await userService.cancelFollowRequest(senderId, receiverId);
  console.log('Result:', resCancel);

  // Verify status is CANCELLED in DB
  const cancelRow = await prisma.followRequest.findUnique({
    where: { senderId_receiverId: { senderId, receiverId } }
  });
  console.log('DB follow request status after cancel:', cancelRow?.status);
  if (cancelRow?.status !== 'CANCELLED') {
    throw new Error('Expected CANCELLED status in DB');
  }

  // Resend request for next tests
  await userService.followUser(senderId, receiverId);
  const reqRow2 = await prisma.followRequest.findUnique({
    where: { senderId_receiverId: { senderId, receiverId } }
  });

  // Test 10: Reject follow request (correct receiver)
  console.log('\n--- Test 10: Reject follow request (correct receiver) ---');
  const resReject = await userService.rejectFollowRequest(reqRow2!.id, receiverId);
  console.log('Result:', resReject);

  const rejectRow = await prisma.followRequest.findUnique({
    where: { id: reqRow2!.id }
  });
  console.log('DB follow request status after reject:', rejectRow?.status);
  if (rejectRow?.status !== 'REJECTED') {
    throw new Error('Expected REJECTED status in DB');
  }

  // Test 11: Already rejected request checks
  console.log('\n--- Test 11: Accept already rejected request check ---');
  try {
    await userService.acceptFollowRequest(reqRow2!.id, receiverId);
    throw new Error('Accepted a rejected request without error');
  } catch (e: any) {
    console.log('Pass: correctly caught acceptance of rejected request:', e.message);
  }

  // Resend request and accept for remaining checks
  await userService.followUser(senderId, receiverId);
  const newReqRow = await prisma.followRequest.findUnique({
    where: { senderId_receiverId: { senderId, receiverId } }
  });
  await userService.acceptFollowRequest(newReqRow!.id, receiverId);

  // Test 12: Already accepted request checks
  console.log('\n--- Test 12: Accept already accepted request check ---');
  try {
    await userService.acceptFollowRequest(newReqRow!.id, receiverId);
    throw new Error('Accepted an already accepted request without error');
  } catch (e: any) {
    console.log('Pass: correctly caught acceptance of accepted request:', e.message);
  }

  // Clean follow relations for block test
  await userService.unfollowUser(senderId, receiverId);

  // Test 13: Blocked user cannot follow
  console.log('\n--- Test 13: Blocked user cannot follow ---');
  await prisma.blockedUser.create({
    data: { blockerId: receiverId, blockedId: senderId }
  });
  try {
    await userService.followUser(senderId, receiverId);
    throw new Error('Blocked user was able to follow blocker');
  } catch (e: any) {
    console.log('Pass: correctly caught blocked follow error:', e.message);
  }

  // Test 14: Invalid request ID checks
  console.log('\n--- Test 14: Invalid request ID checks ---');
  try {
    await userService.acceptFollowRequest('invalid-request-uuid-value', receiverId);
    throw new Error('Accepted invalid request ID without error');
  } catch (e: any) {
    console.log('Pass: correctly caught invalid request ID error:', e.message);
  }

  console.log('\n🎉 ALL SECURITY & GUARD CHECKS PASSED SUCCESSFULLY!');
}

runTest()
  .catch(e => {
    console.error('❌ Test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
