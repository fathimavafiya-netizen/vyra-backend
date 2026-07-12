/**
 * verifyPhase4.ts — Phase 4A & 4B verification
 *
 * Run: npx ts-node src/scripts/verifyPhase4.ts
 *
 * Tests:
 *   Phase 4A:
 *     1.  Send text message
 *     2.  Edit own message
 *     3.  Edit another's message → should 403
 *     4.  Delete own message → placeholder visible
 *     5.  Delete another's message → should 403
 *     6.  React with ❤️ → upsert
 *     7.  React again with 🔥 → updates (not duplicate)
 *     8.  Remove reaction
 *     9.  Mark all read → unread count = 0
 *     10. Group: create → add member → remove member → rename
 *     11. Notification persisted to DB
 *   Phase 4B:
 *     12. CallRepository.createCall → RINGING status
 *     13. CallRepository.updateCall → ANSWERED, then ENDED
 *     14. Call history includes both caller & callee records
 */

import prisma from '../config/db';
import chatRepository from '../repositories/ChatRepository';
import callRepository from '../repositories/CallRepository';
import notificationService from '../services/NotificationService';
import { MessageStatus, CallStatus, NotificationType } from '../config/constants';

const PASS = '✅';
const FAIL = '❌';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`${PASS} ${label}`);
    passed++;
  } else {
    console.error(`${FAIL} FAILED: ${label}`);
    failed++;
  }
}

async function cleanupTestData() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: 'verify4_' } } });
  const ids = users.map(u => u.id);
  if (ids.length === 0) return;

  // Delete in FK-safe order
  await prisma.call.deleteMany({ where: { OR: [{ callerId: { in: ids } }, { calleeId: { in: ids } }] } });
  await prisma.messageReaction.deleteMany({ where: { userId: { in: ids } } });
  await prisma.messageRead.deleteMany({ where: { userId: { in: ids } } });
  await prisma.message.deleteMany({ where: { senderId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.conversationMember.deleteMany({ where: { userId: { in: ids } } });
  await prisma.profile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}


async function createUser(suffix: string) {
  const user = await prisma.user.create({
    data: {
      email: `verify4_${suffix}@test.com`,
      password: 'hashed',
      profile: { create: { name: `Verify User ${suffix}`, username: `verify4_${suffix}` } },
    },
  });
  return user;
}

async function run() {
  console.log('\n🧪 Phase 4A & 4B Verification\n');

  await cleanupTestData();

  const userA = await createUser('a');
  const userB = await createUser('b');
  const userC = await createUser('c');

  // ─── Phase 4A ───

  // 1. Create conversation and send message
  const chat = await chatRepository.createDirectConversation(userA.id, userB.id);
  const msg = await chatRepository.createMessage({
    conversationId: chat.id,
    senderId: userA.id,
    text: 'Hello Phase 4A',
  });
  assert(msg.status === MessageStatus.SENT, '4A-01 Message created with SENT status');
  assert(msg.text === 'Hello Phase 4A', '4A-02 Message text matches');

  // 2. Edit own message
  const edited = await chatRepository.editMessage(msg.id, userA.id, 'Edited text');
  assert(edited.text === 'Edited text', '4A-03 editMessage updates text');
  assert(edited.editedAt !== null, '4A-04 editedAt is set');

  // 3. Edit another's message → should throw
  let editFailed = false;
  try {
    await chatRepository.editMessage(msg.id, userB.id, 'Hack');
  } catch {
    editFailed = true;
  }
  assert(editFailed, '4A-05 editMessage throws 403 for non-owner');

  // 4. Delete own message
  await chatRepository.softDeleteMessage(msg.id, userA.id);
  const deleted = await prisma.message.findUnique({ where: { id: msg.id } });
  assert(deleted?.isDeleted === true, '4A-06 softDeleteMessage sets isDeleted=true');

  // 5. Delete another's message → should throw
  const msg2 = await chatRepository.createMessage({ conversationId: chat.id, senderId: userA.id, text: 'Delete test' });
  let deleteFailed = false;
  try {
    await chatRepository.softDeleteMessage(msg2.id, userB.id);
  } catch {
    deleteFailed = true;
  }
  assert(deleteFailed, '4A-07 softDeleteMessage throws 403 for non-owner');

  // 6. Add reaction ❤️
  const msg3 = await chatRepository.createMessage({ conversationId: chat.id, senderId: userB.id, text: 'React test' });
  const r1 = await chatRepository.addReaction(msg3.id, userA.id, '❤️');
  assert(r1.emoji === '❤️', '4A-08 addReaction creates reaction');

  // 7. React again with 🔥 → upsert (no duplicate)
  const r2 = await chatRepository.addReaction(msg3.id, userA.id, '🔥');
  assert(r2.emoji === '🔥', '4A-09 addReaction upserts (updates existing)');
  const count = await prisma.messageReaction.count({ where: { messageId: msg3.id, userId: userA.id } });
  assert(count === 1, '4A-10 Only one reaction per user (upsert, not duplicate)');

  // 8. Remove reaction
  await chatRepository.removeReaction(msg3.id, userA.id);
  const afterRemove = await prisma.messageReaction.findMany({ where: { messageId: msg3.id, userId: userA.id } });
  assert(afterRemove.length === 0, '4A-11 removeReaction deletes reaction');

  // Remove non-existent reaction → no error
  let removeNoErr = true;
  try {
    await chatRepository.removeReaction(msg3.id, userA.id);
  } catch {
    removeNoErr = false;
  }
  assert(removeNoErr, '4A-12 removeReaction on non-existent is silent (no error)');

  // 9. Mark all read → unread count
  await chatRepository.createMessage({ conversationId: chat.id, senderId: userA.id, text: 'Msg 1' });
  await chatRepository.createMessage({ conversationId: chat.id, senderId: userA.id, text: 'Msg 2' });
  const beforeCount = await chatRepository.getUnreadCount(chat.id, userB.id);
  assert(beforeCount > 0, `4A-13 Unread count > 0 before markAllRead (got ${beforeCount})`);

  await chatRepository.markAllRead(chat.id, userB.id);
  const afterCount = await chatRepository.getUnreadCount(chat.id, userB.id);
  assert(afterCount === 0, '4A-14 Unread count = 0 after markAllRead');

  // 10. Group: create → add → remove → rename
  const group = await chatRepository.createGroupConversation('Test Group', userA.id, [userB.id]);
  assert(group.isGroup === true, '4A-15 Group conversation created');
  assert(group.members.length === 2, '4A-16 Group has 2 members initially');

  // Add member C
  await chatRepository.updateGroup(group.id, userA.id, { addMemberIds: [userC.id] });
  const afterAdd = await prisma.conversationMember.count({ where: { conversationId: group.id } });
  assert(afterAdd === 3, '4A-17 addMember: group has 3 members');

  // Remove member B (non-admin)
  await chatRepository.updateGroup(group.id, userA.id, { removeMemberIds: [userB.id] });
  const afterRemoveMember = await prisma.conversationMember.count({ where: { conversationId: group.id } });
  assert(afterRemoveMember === 2, '4A-18 removeMember: group has 2 members');

  // Rename
  const renamed = await chatRepository.updateGroup(group.id, userA.id, { name: 'Renamed Group' });
  const updatedGroup = await prisma.conversation.findUnique({ where: { id: group.id } });
  assert(updatedGroup?.name === 'Renamed Group', '4A-19 Group renamed correctly');

  // Non-admin cannot update
  let nonAdminFailed = false;
  try {
    await chatRepository.updateGroup(group.id, userC.id, { name: 'Hacked' });
  } catch {
    nonAdminFailed = true;
  }
  assert(nonAdminFailed, '4A-20 Non-admin updateGroup throws error');

  // 11. Notification persisted
  const notif = await notificationService.send({
    userId: userB.id,
    type: NotificationType.NEW_MESSAGE,
    title: 'Test Notif',
    message: 'Hello from verify script',
    referenceId: chat.id,
  });
  const dbNotif = await prisma.notification.findFirst({ where: { userId: userB.id, type: NotificationType.NEW_MESSAGE } });
  assert(dbNotif !== null, '4A-21 Notification persisted to DB');

  // ─── Phase 4B ───

  // 12. createCall → RINGING
  const call = await callRepository.createCall(userA.id, userB.id, 'VOICE');
  assert(call.status === CallStatus.RINGING, '4B-01 createCall status = RINGING');
  assert(call.callerId === userA.id, '4B-02 callerId set correctly');
  assert(call.calleeId === userB.id, '4B-03 calleeId set correctly');

  // 13. updateCall → ANSWERED then ENDED
  await callRepository.updateCall(call.id, CallStatus.ANSWERED);
  const answered = await prisma.call.findUnique({ where: { id: call.id } });
  assert(answered?.status === CallStatus.ANSWERED, '4B-04 updateCall → ANSWERED');

  await callRepository.updateCall(call.id, CallStatus.ENDED, { duration: 120, endedAt: new Date() });
  const ended = await prisma.call.findUnique({ where: { id: call.id } });
  assert(ended?.status === CallStatus.ENDED, '4B-05 updateCall → ENDED');
  assert(ended?.duration === 120, '4B-06 Call duration stored correctly');
  assert(ended?.endedAt !== null, '4B-07 endedAt persisted');

  // 14. Call history
  const history = await callRepository.getCallHistory(userA.id);
  assert(history.length >= 1, '4B-08 getCallHistory returns calls for caller');
  const historyB = await callRepository.getCallHistory(userB.id);
  assert(historyB.length >= 1, '4B-09 getCallHistory returns calls for callee');

  // MISSED + REJECTED flows
  const call2 = await callRepository.createCall(userA.id, userB.id, 'VIDEO');
  await callRepository.updateCall(call2.id, CallStatus.MISSED, { endedAt: new Date() });
  const missed = await prisma.call.findUnique({ where: { id: call2.id } });
  assert(missed?.status === CallStatus.MISSED, '4B-10 MISSED status stored');

  const call3 = await callRepository.createCall(userA.id, userB.id, 'VOICE');
  await callRepository.updateCall(call3.id, CallStatus.REJECTED, { endedAt: new Date() });
  const rejected = await prisma.call.findUnique({ where: { id: call3.id } });
  assert(rejected?.status === CallStatus.REJECTED, '4B-11 REJECTED status stored');

  // Cleanup
  await cleanupTestData();

  // Summary
  const total = passed + failed;
  console.log(`\n──────────────────────────────────────`);
  console.log(`Phase 4 Verification: ${passed}/${total} passed`);
  if (failed > 0) {
    console.error(`${failed} test(s) FAILED`);
    process.exit(1);
  } else {
    console.log('All tests passed! 🎉');
  }

  await prisma.$disconnect();
}

run().catch(async err => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
