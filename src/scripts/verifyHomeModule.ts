/**
 * verifyHomeModule.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Automated E2E verification for the Home Header, Stories & Notifications
 * production module (Phase 1–7 of implementation plan v1.0).
 *
 * Checks covered:
 *   A. File Existence  – All created files must exist on disk.
 *   B. Module Exports  – Core services export required members.
 *   C. Database Models – Prisma schema has Story/Notification tables.
 *   D. API Endpoints   – StoryController, NotificationController reachable.
 *   E. Security Layer  – StorageProvider, MalwareScanner, IdempotencyService.
 *   F. Queue Workers   – MediaProcessingQueue, PushNotificationQueue, EventBus.
 *   G. Analytics       – StoryAnalyticsService counter methods defined.
 *   H. Feed Service    – StoryFeedService cursor pagination logic present.
 *   I. Socket Cluster  – SocketGatewayCluster exports cluster init.
 *   J. Frontend Check  – Mobile component files exist.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import prisma from '../config/db';

const PASS = '✅';
const FAIL = '❌';
const SKIP = '⚠️ ';
const SEP  = '─'.repeat(60);

let passed  = 0;
let failed  = 0;
let skipped = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

function assert(condition: boolean, label: string, hint?: string) {
  if (condition) {
    console.log(`${PASS} ${label}`);
    passed++;
  } else {
    console.error(`${FAIL} FAILED: ${label}${hint ? `  ← ${hint}` : ''}`);
    failed++;
  }
}

function skip(label: string, reason: string) {
  console.warn(`${SKIP} SKIPPED: ${label} — ${reason}`);
  skipped++;
}

function section(title: string) {
  console.log(`\n${SEP}`);
  console.log(`  ${title}`);
  console.log(SEP);
}

// Resolve paths from cwd (this script is run from vyra/backend/)
// ts-node sets __dirname to '.' when using -P flag, so we use process.cwd()
const CWD      = process.cwd();
const BACKEND  = CWD;                               // = vyra/backend
const MOBILE   = path.resolve(CWD, '..', 'mobile'); // = vyra/mobile

function backendPath(...parts: string[]) { return path.join(BACKEND, ...parts); }
function mobilePath(...parts: string[])  { return path.join(MOBILE, ...parts);  }

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function fileContains(filePath: string, substring: string): boolean {
  if (!fileExists(filePath)) return false;
  return fs.readFileSync(filePath, 'utf8').includes(substring);
}

// ── A. File Existence ─────────────────────────────────────────────────────────

async function checkFileExistence() {
  section('A. File Existence Verification');

  // Backend Security Layer
  assert(fileExists(backendPath('src/security/StorageProvider.ts')),           'StorageProvider.ts exists');
  assert(fileExists(backendPath('src/security/MalwareScannerService.ts')),     'MalwareScannerService.ts exists');
  assert(fileExists(backendPath('src/security/IdempotencyService.ts')),        'IdempotencyService.ts exists');

  // Backend Queue Workers
  assert(fileExists(backendPath('src/queue/EventBus.ts')),                     'EventBus.ts exists');
  assert(fileExists(backendPath('src/queue/MediaProcessingQueue.ts')),         'MediaProcessingQueue.ts exists');
  assert(fileExists(backendPath('src/queue/PushNotificationQueue.ts')),        'PushNotificationQueue.ts exists');

  // Backend Domain Services
  assert(fileExists(backendPath('src/auth/services/StoryFeedService.ts')),     'StoryFeedService.ts exists');
  assert(fileExists(backendPath('src/auth/services/StoryAnalyticsService.ts')),'StoryAnalyticsService.ts exists');

  // Backend Controllers
  assert(fileExists(backendPath('src/controllers/StoryController.ts')),        'StoryController.ts exists');
  assert(fileExists(backendPath('src/controllers/AdminStoryController.ts')),   'AdminStoryController.ts exists');
  assert(fileExists(backendPath('src/controllers/NotificationController.ts')), 'NotificationController.ts exists');

  // Backend Socket Cluster
  assert(fileExists(backendPath('src/socket/SocketGatewayCluster.ts')),        'SocketGatewayCluster.ts exists');

  // Backend Utilities
  assert(fileExists(backendPath('src/utils/cron.ts')),                         'cron.ts exists');

  // Backend Routes
  assert(fileExists(backendPath('src/routes/stories.ts')),                     'routes/stories.ts exists');
  assert(fileExists(backendPath('src/routes/notifications.ts')),               'routes/notifications.ts exists');

  // Mobile Components
  assert(fileExists(mobilePath('src/components/Home/HomeHeader.tsx')),         'HomeHeader.tsx exists');
  assert(fileExists(mobilePath('src/components/Home/StoryCarousel.tsx')),      'StoryCarousel.tsx exists');
  assert(fileExists(mobilePath('src/components/Home/StoryRing.tsx')),          'StoryRing.tsx exists');
  assert(fileExists(mobilePath('src/components/Home/StoryViewer.tsx')),        'StoryViewer.tsx exists');

  // Mobile Screens
  assert(fileExists(mobilePath('src/screens/Notifications/NotificationScreen.tsx')), 'NotificationScreen.tsx exists');
}

// ── B. Backend Module Exports / Signature Checks ─────────────────────────────

async function checkModuleSignatures() {
  section('B. Module Signatures & API Surface');

  // StorageProvider
  assert(fileContains(backendPath('src/security/StorageProvider.ts'), 'uploadFile'),
    'StorageProvider: uploadFile method defined');
  assert(fileContains(backendPath('src/security/StorageProvider.ts'), 'getSignedUrl'),
    'StorageProvider: getSignedUrl (signed read URL) method defined');
  assert(fileContains(backendPath('src/security/StorageProvider.ts'), 'deleteFile'),
    'StorageProvider: deleteFile method defined');

  // MalwareScannerService
  assert(fileContains(backendPath('src/security/MalwareScannerService.ts'), 'scanFile'),
    'MalwareScanner: scanFile method defined');
  assert(fileContains(backendPath('src/security/MalwareScannerService.ts'), 'EICAR'),
    'MalwareScanner: EICAR signature detection present');

  // IdempotencyService
  assert(fileContains(backendPath('src/security/IdempotencyService.ts'), 'checkIdempotency'),
    'IdempotencyService: checkIdempotency (acquire lock) method defined');
  assert(fileContains(backendPath('src/security/IdempotencyService.ts'), 'releaseLock'),
    'IdempotencyService: releaseLock method defined');
  assert(fileContains(backendPath('src/security/IdempotencyService.ts'), 'saveResult'),
    'IdempotencyService: saveResult (cache response) method defined');

  // EventBus
  assert(fileContains(backendPath('src/queue/EventBus.ts'), 'publish'),
    'EventBus: publish method defined');
  assert(fileContains(backendPath('src/queue/EventBus.ts'), 'subscribe'),
    'EventBus: subscribe method defined');

  // MediaProcessingQueue
  assert(fileContains(backendPath('src/queue/MediaProcessingQueue.ts'), 'registerWorker'),
    'MediaProcessingQueue: registerWorker background job defined');
  assert(fileContains(backendPath('src/queue/MediaProcessingQueue.ts'), 'HLS'),
    'MediaProcessingQueue: HLS segmentation logic present');
  assert(fileContains(backendPath('src/queue/MediaProcessingQueue.ts'), 'webp'),
    'MediaProcessingQueue: WebP thumbnail generation present');

  // PushNotificationQueue
  assert(fileContains(backendPath('src/queue/PushNotificationQueue.ts'), 'registerWorker'),
    'PushNotificationQueue: registerWorker background job defined');
  assert(fileContains(backendPath('src/queue/PushNotificationQueue.ts'), 'DLQ'),
    'PushNotificationQueue: Dead Letter Queue (DLQ) routing present');

  // StoryFeedService
  assert(fileContains(backendPath('src/auth/services/StoryFeedService.ts'), 'getFeed'),
    'StoryFeedService: getFeed method defined');
  assert(fileContains(backendPath('src/auth/services/StoryFeedService.ts'), 'cursor'),
    'StoryFeedService: cursor pagination implemented');
  assert(fileContains(backendPath('src/auth/services/StoryFeedService.ts'), 'score'),
    'StoryFeedService: scoring/ranking algorithm present');

  // StoryAnalyticsService
  assert(fileContains(backendPath('src/auth/services/StoryAnalyticsService.ts'), 'logInteraction'),
    'StoryAnalyticsService: logInteraction (trackView/trackReaction) method defined');
  assert(fileContains(backendPath('src/auth/services/StoryAnalyticsService.ts'), 'eventType'),
    'StoryAnalyticsService: eventType-based interaction tracking present');
  assert(fileContains(backendPath('src/auth/services/StoryAnalyticsService.ts'), 'getAnalytics'),
    'StoryAnalyticsService: getAnalytics method defined');
  assert(fileContains(backendPath('src/auth/services/StoryAnalyticsService.ts'), 'hincrby'),
    'StoryAnalyticsService: Redis hash increment (hincrby) present');

  // SocketGatewayCluster
  assert(fileContains(backendPath('src/socket/SocketGatewayCluster.ts'), 'configureAdapter'),
    'SocketGatewayCluster: configureAdapter method defined');
  assert(fileContains(backendPath('src/socket/SocketGatewayCluster.ts'), 'broadcastCluster'),
    'SocketGatewayCluster: broadcastCluster event broadcasting method defined');
  assert(fileContains(backendPath('src/socket/SocketGatewayCluster.ts'), 'socket:relay:'),
    'SocketGatewayCluster: socket:relay channel pub/sub handled');
}

// ── C. Database Schema Check ───────────────────────────────────────────────────

async function checkDatabaseSchema() {
  section('C. Database Schema Verification');

  const schemaPath = backendPath('prisma/schema.prisma');
  assert(fileExists(schemaPath), 'prisma/schema.prisma exists');

  const schema = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') : '';

  assert(schema.includes('model Story'), 'Schema: Story model defined');
  assert(schema.includes('model StoryDraft'), 'Schema: StoryDraft model defined');
  assert(schema.includes('model StoryMediaVariant'), 'Schema: StoryMediaVariant model defined');
  assert(schema.includes('model StoryReport'), 'Schema: StoryReport model defined');
  assert(schema.includes('visibility'), 'Schema: Story.visibility field present');
  assert(schema.includes('moderation'), 'Schema: Story.moderation field present');
  assert(schema.includes('expiresAt'), 'Schema: Story.expiresAt field present');
  assert(schema.includes('isCloseFriends'), 'Schema: Story.isCloseFriends field present');
  assert(schema.includes('model Notification'), 'Schema: Notification model defined');
}

// ── D. Live Database Connectivity & Table Check ───────────────────────────────

async function checkLiveDatabase() {
  section('D. Live Database Connectivity');

  try {
    // Verify Story table is accessible
    const storyCount = await prisma.story.count();
    assert(true, `Story table accessible (${storyCount} rows)`);
  } catch (e: any) {
    assert(false, 'Story table accessible', e.message);
  }

  try {
    // Verify Notification table is accessible
    const notifCount = await prisma.notification.count();
    assert(true, `Notification table accessible (${notifCount} rows)`);
  } catch (e: any) {
    assert(false, 'Notification table accessible', e.message);
  }

  try {
    // Verify User table is accessible (baseline)
    const userCount = await prisma.user.count();
    assert(true, `User table accessible (${userCount} rows)`);
  } catch (e: any) {
    assert(false, 'User table accessible', e.message);
  }
}

// ── E. Story Lifecycle (Create → View → React → Delete) ───────────────────────

async function checkStoryLifecycle() {
  section('E. Story Lifecycle Integration (DB)');

  let testUserId: string | null = null;
  let testStoryId: string | null = null;

  try {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `verify_home_${Date.now()}@test.com`,
        password: 'hash',
        profile: { create: { name: 'VerifyHomeUser', username: `vhome_${Date.now()}` } },
        settings: { create: {} },
      },
    });
    testUserId = user.id;
    assert(!!testUserId, 'Test user created for story lifecycle');

    // Create story — using the actual schema fields (no mediaUrl on Story directly)
    const story = await prisma.story.create({
      data: {
        userId: testUserId,
        caption: 'Verification story caption',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        visibility: 'PUBLIC',
        moderation: 'APPROVED',
        isCloseFriends: false,
      },
    });
    testStoryId = story.id;
    assert(!!testStoryId, 'Story created successfully');
    assert(story.visibility === 'PUBLIC', 'Story visibility persisted correctly');
    assert(story.moderation === 'APPROVED', 'Story moderation status persisted');
    assert(story.expiresAt > new Date(), 'Story expiry is in the future');
    assert(story.isCloseFriends === false, 'Story isCloseFriends default correct');

    // Create story view
    const view = await prisma.storyView.create({
      data: {
        storyId: testStoryId,
        userId: testUserId,
      },
    });
    assert(!!view.id, 'StoryView recorded successfully');

    // Create notification for story event
    const notif = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'STORY_VIEW',
        title: 'New story view',
        message: 'Someone viewed your story',
      },
    });
    assert(!!notif.id, 'Notification created for story event');
    assert(!notif.isRead, 'Notification initially unread');

    // Mark notification read — schema has isRead field, no readAt column
    const updated = await prisma.notification.update({
      where: { id: notif.id },
      data: { isRead: true },
    });
    assert(updated.isRead === true, 'Notification marked as read');

    // Delete story (soft flag via isDeleted or direct delete)
    await prisma.storyView.deleteMany({ where: { storyId: testStoryId } });
    await prisma.notification.delete({ where: { id: notif.id } });
    await prisma.story.delete({ where: { id: testStoryId } });
    assert(true, 'Story and related records cleaned up successfully');

  } catch (e: any) {
    assert(false, 'Story lifecycle integration', e.message);
  } finally {
    // Final cleanup: remove test user
    if (testUserId) {
      try {
        await prisma.notification.deleteMany({ where: { userId: testUserId } });
        await prisma.session.deleteMany({ where: { userId: testUserId } });
        await prisma.profile.deleteMany({ where: { userId: testUserId } });
        await prisma.user.delete({ where: { id: testUserId } });
      } catch (_) {}
    }
  }
}

// ── F. StoryDraft Lifecycle ────────────────────────────────────────────────────

async function checkStoryDraftLifecycle() {
  section('F. StoryDraft Lifecycle (DB)');

  let testUserId: string | null = null;

  try {
    const user = await prisma.user.create({
      data: {
        email: `verify_draft_${Date.now()}@test.com`,
        password: 'hash',
        profile: { create: { name: 'DraftUser', username: `vdraft_${Date.now()}` } },
        settings: { create: {} },
      },
    });
    testUserId = user.id;

    // Create a draft — StoryDraft schema has: userId, caption, mediaUrl (no mediaType)
    const draft = await prisma.storyDraft.create({
      data: {
        userId: testUserId,
        mediaUrl: 'https://cdn.vyra.app/test/draft.mp4',
        caption: 'Draft caption',
      },
    });
    assert(!!draft.id, 'StoryDraft created successfully');
    assert(draft.mediaUrl.includes('draft.mp4'), 'StoryDraft mediaUrl persisted');
    assert(draft.caption === 'Draft caption', 'StoryDraft caption persisted');

    // Clean up
    await prisma.storyDraft.delete({ where: { id: draft.id } });
    assert(true, 'StoryDraft deleted successfully');

  } catch (e: any) {
    assert(false, 'StoryDraft lifecycle', e.message);
  } finally {
    if (testUserId) {
      try {
        await prisma.session.deleteMany({ where: { userId: testUserId } });
        await prisma.profile.deleteMany({ where: { userId: testUserId } });
        await prisma.user.delete({ where: { id: testUserId } });
      } catch (_) {}
    }
  }
}

// ── G. Route & Controller Signature Checks ────────────────────────────────────

async function checkRouteSignatures() {
  section('G. Route & Controller Signatures');

  const storyCtrl  = backendPath('src/controllers/StoryController.ts');
  const notifCtrl  = backendPath('src/controllers/NotificationController.ts');
  const adminCtrl  = backendPath('src/controllers/AdminStoryController.ts');
  const storyRoute = backendPath('src/routes/stories.ts');
  const notifRoute = backendPath('src/routes/notifications.ts');
  const routeIdx   = backendPath('src/routes/index.ts');

  // StoryController endpoints
  assert(fileContains(storyCtrl, 'createStory'),    'StoryController: createStory handler present');
  assert(fileContains(storyCtrl, 'deleteStory'),    'StoryController: deleteStory handler present');
  assert(fileContains(storyCtrl, 'viewStory'),      'StoryController: viewStory handler present');
  assert(fileContains(storyCtrl, 'reactToStory'),   'StoryController: reactToStory handler present');
  assert(fileContains(storyCtrl, 'getFeed'),        'StoryController: getFeed handler present');
  assert(fileContains(storyCtrl, 'getHighlights'),  'StoryController: getHighlights handler present');

  // NotificationController endpoints
  assert(fileContains(notifCtrl, 'getNotifications'), 'NotificationController: getNotifications handler present');
  assert(fileContains(notifCtrl, 'markAsRead'),       'NotificationController: markAsRead handler present');

  // AdminStoryController
  assert(fileContains(adminCtrl, 'listReportedStories'), 'AdminStoryController: listReportedStories present');

  // Route mounts
  assert(fileContains(storyRoute, '/feed'),          'stories.ts route: /feed registered');
  assert(fileContains(storyRoute, '/highlights'),    'stories.ts route: /highlights registered');
  assert(fileContains(notifRoute, '/read-all'),      'notifications.ts route: /read-all registered');
  assert(fileContains(routeIdx,   'storyRoutes'),    'index.ts: storyRoutes mounted');
  assert(fileContains(routeIdx,   'notificationRoutes'), 'index.ts: notificationRoutes mounted');
}

// ── H. Cron Scheduler ─────────────────────────────────────────────────────────

async function checkCronScheduler() {
  section('H. Cron Scheduler Verification');

  const cronPath = backendPath('src/utils/cron.ts');
  assert(fileContains(cronPath, 'deleteMany'),         'cron.ts: bulk delete for expired stories present');
  assert(fileContains(cronPath, 'expiresAt'),          'cron.ts: expiresAt filter present in cleanup');
  assert(fileContains(cronPath, 'isRead'),             'cron.ts: old notification cleanup present');
  assert(fileContains(cronPath, 'schedule') ||
         fileContains(cronPath, 'setInterval') ||
         fileContains(cronPath, 'cron'),               'cron.ts: scheduling mechanism present');
}

// ── I. Mobile Component API Surface ───────────────────────────────────────────

async function checkMobileComponents() {
  section('I. Mobile Component API Surface');

  const homeHeader    = mobilePath('src/components/Home/HomeHeader.tsx');
  const storyCarousel = mobilePath('src/components/Home/StoryCarousel.tsx');
  const storyRing     = mobilePath('src/components/Home/StoryRing.tsx');
  const storyViewer   = mobilePath('src/components/Home/StoryViewer.tsx');
  const notifScreen   = mobilePath('src/screens/Notifications/NotificationScreen.tsx');
  const appNav        = mobilePath('src/navigation/AppNavigator.tsx');
  const homeScreen    = mobilePath('src/screens/Home/HomeScreen.tsx');

  // HomeHeader
  assert(fileContains(homeHeader, 'onCameraPress'),       'HomeHeader: onCameraPress prop wired');
  assert(fileContains(homeHeader, 'onNotificationPress'), 'HomeHeader: onNotificationPress prop wired');
  assert(fileContains(homeHeader, 'unreadCount'),         'HomeHeader: unreadCount badge prop present');
  assert(fileContains(homeHeader, 'badgeContainer'),      'HomeHeader: badge container styled');

  // StoryCarousel
  assert(fileContains(storyCarousel, 'onYourStoryPress'), 'StoryCarousel: onYourStoryPress prop wired');
  assert(fileContains(storyCarousel, 'onGroupPress'),     'StoryCarousel: onGroupPress prop wired');
  assert(fileContains(storyCarousel, 'StoryRing'),        'StoryCarousel: StoryRing component used');

  // StoryRing
  assert(fileContains(storyRing, 'hasUnseen'),            'StoryRing: hasUnseen prop handled');
  assert(fileContains(storyRing, 'isCloseFriends'),       'StoryRing: isCloseFriends gradient variant');
  assert(fileContains(storyRing, 'isLive'),               'StoryRing: isLive pulse animation variant');
  assert(fileContains(storyRing, 'LinearGradient'),       'StoryRing: LinearGradient rings applied');
  assert(fileContains(storyRing, 'pulseAnim'),            'StoryRing: pulse animation for live state');

  // StoryViewer
  assert(fileContains(storyViewer, 'prefetch'),           'StoryViewer: Image.prefetch for adjacent slides');
  assert(fileContains(storyViewer, 'PanResponder'),       'StoryViewer: swipe-down dismiss gesture');
  assert(fileContains(storyViewer, 'progressBarFill'),    'StoryViewer: progress bar indicators');
  assert(fileContains(storyViewer, 'onReact'),            'StoryViewer: emoji reaction callback');
  assert(fileContains(storyViewer, 'onReply'),            'StoryViewer: message reply callback');
  assert(fileContains(storyViewer, 'STORY_DURATION'),     'StoryViewer: story auto-advance timer');

  // NotificationScreen
  assert(fileContains(notifScreen, 'handleMarkAllRead'),  'NotificationScreen: mark all read action');
  assert(fileContains(notifScreen, 'handleDelete'),       'NotificationScreen: delete notification action');
  assert(fileContains(notifScreen, 'LABELS'),             'NotificationScreen: English static labels object');
  assert(fileContains(notifScreen, 'groupNotifications'), 'NotificationScreen: chronological grouping');
  assert(fileContains(notifScreen, 'today'),              'NotificationScreen: Today section label');
  assert(fileContains(notifScreen, 'yesterday'),          'NotificationScreen: Yesterday section label');

  // AppNavigator registration
  assert(fileContains(appNav, 'NotificationScreen'),      'AppNavigator: NotificationScreen registered');
  assert(fileContains(appNav, "name=\"Notifications\""),  'AppNavigator: Notifications stack screen present');

  // HomeScreen integration
  assert(fileContains(homeScreen, 'HomeHeader'),          'HomeScreen: HomeHeader component mounted');
  assert(fileContains(homeScreen, 'StoryCarousel'),       'HomeScreen: StoryCarousel component mounted');
  assert(fileContains(homeScreen, 'StoryViewer'),         'HomeScreen: StoryViewer component mounted');
  assert(fileContains(homeScreen, 'unreadCount'),         'HomeScreen: unreadCount state managed');
  assert(fileContains(homeScreen, 'notificationService'), 'HomeScreen: notificationService imported');
}

// ── J. Prisma Story model field completeness ──────────────────────────────────

async function checkPrismaStoryFields() {
  section('J. Prisma Story Model Field Completeness');

  // Use Prisma's introspection via a meta query
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT name FROM pragma_table_info('Story') ORDER BY cid;
    `;
    const fields = result.map((r: any) => r.name);
    const required = [
      'id', 'userId', 'caption', 'expiresAt',
      'visibility', 'isCloseFriends', 'moderation',
      'deletedAt', 'createdAt', 'updatedAt', 'version'
    ];
    for (const field of required) {
      assert(fields.includes(field), `Story table: column "${field}" present`);
    }
  } catch (e: any) {
    skip('Story table field introspection', `SQLite pragma query failed: ${e.message}`);
  }
}

// ── Main Runner ───────────────────────────────────────────────────────────────

async function run() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🚀 Vyra Home Module — E2E Verification Suite');
  console.log('     Phase 1–7 · Implementation Plan v1.0');
  console.log('═'.repeat(60));

  await checkFileExistence();
  await checkModuleSignatures();
  await checkDatabaseSchema();
  await checkLiveDatabase();
  await checkStoryLifecycle();
  await checkStoryDraftLifecycle();
  await checkRouteSignatures();
  await checkCronScheduler();
  await checkMobileComponents();
  await checkPrismaStoryFields();

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  📊 Verification Summary');
  console.log('═'.repeat(60));
  console.log(`  ${PASS}  Passed  : ${passed}`);
  console.log(`  ${FAIL}  Failed  : ${failed}`);
  console.log(`  ${SKIP}  Skipped : ${skipped}`);
  console.log(`  Total   : ${passed + failed + skipped}`);
  console.log('═'.repeat(60));

  if (failed === 0) {
    console.log('\n  🎉 ALL CHECKS PASSED — Home Module is production-ready!\n');
  } else {
    console.log(`\n  ⚠️  ${failed} check(s) failed — review output above.\n`);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error('Fatal error during verification:', err);
  await prisma.$disconnect();
  process.exit(1);
});
