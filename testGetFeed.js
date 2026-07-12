const postService = require('./dist/services/PostService').default;

async function test() {
  console.log('Testing getFeed via service...');
  try {
    const posts = await postService.getFeed('db498135-d16d-4884-a582-43f6d407cf01', {
      sort: 'newest',
      limit: 10
    });
    console.log(`Feed posts count: ${posts.length}`);
    posts.forEach(p => {
      console.log(`Post ID: ${p.id}, User ID: ${p.userId}, Type: ${p.type}, Caption: ${p.caption}`);
    });
  } catch (err) {
    console.error('Error fetching feed:', err);
  }
}

test();
