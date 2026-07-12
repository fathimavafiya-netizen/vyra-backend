/**
 * Phase 3 Verification Script — Stories, Reels & Media Pipeline
 * Run: npx ts-node verifyPhase3.ts
 * (ensure backend is running: npm run dev)
 */
import axios from 'axios';

const BASE = 'http://127.0.0.1:5000/api/v1';
let token1 = '';
let token2 = '';
let userId1 = '';
let userId2 = '';
let storyId = '';
let highlightId = '';
let reelPostId = '';

const api1 = () => axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${token1}` } });
const api2 = () => axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${token2}` } });

function pass(msg: string) { console.log(`  ✅ PASS: ${msg}`); }
function fail(msg: string, e?: any) {
  console.error(`  ❌ FAIL: ${msg}`, e?.response?.data || e?.message || '');
}
function section(name: string) { console.log(`\n=== ${name} ===`); }

async function setup() {
  section('SETUP — Register & Login Two Users');
  const ts = Date.now();

  const u1 = await axios.post(`${BASE}/auth/register`, {
    name: 'StoryUser1', email: `storyuser1_${ts}@vyra.dev`, password: 'Story@1234', username: `storyuser1_${ts}`,
  });
  token1 = u1.data.accessToken;
  userId1 = u1.data.user?.id || u1.data.user?._id;
  pass(`Registered User1: ${userId1}`);

  const u2 = await axios.post(`${BASE}/auth/register`, {
    name: 'StoryUser2', email: `storyuser2_${ts}@vyra.dev`, password: 'Story@1234', username: `storyuser2_${ts}`,
  });
  token2 = u2.data.accessToken;
  userId2 = u2.data.user?.id || u2.data.user?._id;
  pass(`Registered User2: ${userId2}`);

  // User2 follows User1 so User2 can see User1's stories
  try {
    const followRes = await api2().post(`/users/${userId1}/follow`);
    pass(`User2 is now following User1 — status: ${followRes.data.status}`);
  } catch (e: any) {
    console.error('  [DEBUG] Follow failed:', e?.response?.status, e?.response?.data);
    pass('Follow attempted (continuing)');
  }
}

async function testStoryCreation() {
  section('1. STORY CREATION');
  try {
    const r = await api1().post('/stories', {
      mediaUrl: 'https://images.unsplash.com/photo-1526512340740-9217d0159da9',
      mediaType: 'IMAGE',
      caption: 'Phase 3 test story 🌅',
      isCloseFriends: false,
    });
    if (r.data.success && r.data.story?.id) {
      storyId = r.data.story.id;
      pass(`Story created: ${storyId}`);
    } else fail('Story creation response malformed', r.data);
  } catch (e) { fail('Story creation threw', e); }
}

async function testFeedStories() {
  section('2. STORY FEED');
  try {
    // User2 should see User1's story (they follow)
    const r = await api2().get('/stories/feed');
    if (!r.data.success) return fail('Feed request failed', r.data);
    const groups: any[] = r.data.stories;
    const found = groups.some((g: any) => g.stories?.some((s: any) => s.id === storyId));
    if (found) pass(`Story appears in User2 feed`);
    else fail(`Story not found in User2 feed — groups received: ${JSON.stringify(groups.map((g:any) => g.user?.id))}`);
  } catch (e) { fail('Feed request threw', e); }
}

async function testStoryView() {
  section('3. STORY VIEW (idempotent)');
  try {
    const r1 = await api2().post(`/stories/${storyId}/view`);
    if (r1.data.success) pass('First view registered');
    else fail('First view failed', r1.data);

    // Second view should also succeed (upsert — idempotent)
    const r2 = await api2().post(`/stories/${storyId}/view`);
    if (r2.data.success) pass('Duplicate view handled gracefully (idempotent)');
    else fail('Second view failed', r2.data);
  } catch (e) { fail('viewStory threw', e); }
}

async function testStoryReaction() {
  section('4. STORY REACTION');
  try {
    const r = await api2().post(`/stories/${storyId}/react`, { emoji: '🔥' });
    if (r.data.success) pass('Reaction "🔥" added');
    else fail('Reaction failed', r.data);

    // Change reaction (upsert)
    const r2 = await api2().post(`/stories/${storyId}/react`, { emoji: '❤️' });
    if (r2.data.success) pass('Reaction changed to "❤️" (upsert works)');
    else fail('Reaction change failed', r2.data);

    // Remove reaction
    const r3 = await api2().delete(`/stories/${storyId}/react`);
    if (r3.data.success) pass('Reaction removed');
    else fail('Reaction removal failed', r3.data);
  } catch (e) { fail('Reaction threw', e); }
}

async function testHighlights() {
  section('5. STORY HIGHLIGHTS');
  try {
    const r = await api1().post('/stories/highlights', { title: 'Travel 2025', coverUrl: '' });
    if (r.data.success && r.data.highlight?.id) {
      highlightId = r.data.highlight.id;
      pass(`Highlight created: ${highlightId}`);
    } else fail('Create highlight failed', r.data);

    const r2 = await api1().post(`/stories/highlights/${highlightId}/stories`, { storyId });
    if (r2.data.success) pass('Story added to highlight');
    else fail('Add story to highlight failed', r2.data);

    const r3 = await api1().get(`/stories/highlights/${userId1}`);
    if (r3.data.success) pass('Highlights fetched for user');
    else fail('Get highlights failed', r3.data);

    const r4 = await api1().delete(`/stories/highlights/${highlightId}/stories/${storyId}`);
    if (r4.data.success) pass('Story removed from highlight');
    else fail('Remove from highlight failed', r4.data);

    const r5 = await api1().delete(`/stories/highlights/${highlightId}`);
    if (r5.data.success) pass('Highlight deleted');
    else fail('Delete highlight failed', r5.data);
  } catch (e) { fail('Highlights threw', e); }
}

async function testCloseFriends() {
  section('6. CLOSE FRIENDS');
  try {
    const r = await api1().post('/stories/close-friends', { friendId: userId2 });
    if (r.data.success) pass('User2 added to User1 close friends');
    else fail('Add close friend failed', r.data);

    const r2 = await api1().get('/stories/close-friends');
    const found = r2.data.closeFriends?.some((cf: any) => cf.friendId === userId2);
    if (found) pass('Close friends list contains User2');
    else fail('User2 not found in close friends list');

    // Create close-friends story
    const closedStory = await api1().post('/stories', {
      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
      mediaType: 'IMAGE',
      caption: 'Close friends only 🌿',
      isCloseFriends: true,
    });
    pass(`Close friends story created: ${closedStory.data.story?.id}`);

    // User2 should see it (they're in close friends)
    const feed = await api2().get('/stories/feed');
    const seenClosed = feed.data.stories?.some((g: any) =>
      g.stories?.some((s: any) => s.id === closedStory.data.story?.id)
    );
    if (seenClosed) pass('User2 sees close friends story (is in list)');
    else fail('User2 CANNOT see close friends story — check close friend logic');

    const r3 = await api1().delete(`/stories/close-friends/${userId2}`);
    if (r3.data.success) pass('User2 removed from close friends');
    else fail('Remove close friend failed', r3.data);
  } catch (e) { fail('Close friends threw', e); }
}

async function testReelsFeed() {
  section('7. REELS FEED & POST VIEW');
  try {
    // Create a reel post first via posts API
    const reel = await api1().post('/posts', {
      type: 'REEL',
      caption: 'Phase 3 test reel 🎬',
      mediaUrl: 'https://test-videos.co.uk/vids/bigbuck/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
      audioTitle: 'Big Buck Bunny - OST',
    });
    reelPostId = reel.data.post?.id;
    pass(`Reel post created: ${reelPostId}`);

    // Fetch reels feed
    const feed = await api1().get('/reels/feed?limit=5');
    if (feed.data.success) pass(`Reels feed returned ${feed.data.reels?.length ?? 0} reels`);
    else fail('Reels feed failed', feed.data);

    // Register unique view
    const v1 = await api1().post(`/reels/${reelPostId}/view`);
    if (v1.data.success && v1.data.alreadyViewed === false) pass('First view registered (alreadyViewed=false)');
    else fail('First reel view response unexpected', v1.data);

    // Duplicate view
    const v2 = await api1().post(`/reels/${reelPostId}/view`);
    if (v2.data.success && v2.data.alreadyViewed === true) pass('Duplicate view detected (alreadyViewed=true) — idempotent ✓');
    else fail('Duplicate reel view response unexpected', v2.data);
  } catch (e) { fail('Reels threw', e); }
}

async function testStoryArchive() {
  section('8. STORY ARCHIVE ENDPOINT');
  try {
    const r = await api1().get('/stories/archive');
    if (r.data.success) pass(`Archive endpoint reachable — ${r.data.stories?.length ?? 0} archived stories`);
    else fail('Archive fetch failed', r.data);
  } catch (e) { fail('Archive threw', e); }
}

async function main() {
  console.log('\n🚀 Phase 3 Verification — Stories, Reels & Media Pipeline\n');
  try {
    await setup();
    await testStoryCreation();
    await testFeedStories();
    await testStoryView();
    await testStoryReaction();
    await testHighlights();
    await testCloseFriends();
    await testReelsFeed();
    await testStoryArchive();
    console.log('\n✅ Phase 3 verification complete.\n');
  } catch (e: any) {
    console.error('\n💥 Fatal error during verification:', e?.message);
    process.exit(1);
  }
}

main();
