// In-memory data store to fallback to when MongoDB is not connected/available.
const mockDb = {
  users: [],
  posts: [],
  messages: [],
  liveStreams: [],
  otps: new Map(), // mobile -> otp

  // Pre-seed some mock users, posts and videos for a vibrant experience immediately!
  seed: function() {
    if (this.users.length > 0) return;

    console.log('🌱 Seeding mock in-memory database with initial Vyra content...');

    // Mock Users
    const usersList = [
      {
        _id: '60c72b2f9b1d8b2badcf5001',
        name: 'Aria Sharma',
        email: 'aria@vyra.com',
        mobile: '+919876543210',
        password: 'hashedpassword',
        profilePic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
        coverPic: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&h=300&q=80',
        bio: 'Creating vibes & sharing stories 💫 Travel | Lifestyle | Tech',
        followers: ['60c72b2f9b1d8b2badcf5002', '60c72b2f9b1d8b2badcf5003'],
        following: ['60c72b2f9b1d8b2badcf5002'],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        _id: '60c72b2f9b1d8b2badcf5002',
        name: 'Kabir Verma',
        email: 'kabir@vyra.com',
        mobile: '+919999888877',
        password: 'hashedpassword',
        profilePic: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
        coverPic: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&h=300&q=80',
        bio: 'Music is my escape. 🎸 Singer-songwriter. Let\'s connect!',
        followers: ['60c72b2f9b1d8b2badcf5001'],
        following: ['60c72b2f9b1d8b2badcf5001', '60c72b2f9b1d8b2badcf5003'],
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      },
      {
        _id: '60c72b2f9b1d8b2badcf5003',
        name: 'Zara Taylor',
        email: 'zara@vyra.com',
        mobile: '+12025550143',
        password: 'hashedpassword',
        profilePic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
        coverPic: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&h=300&q=80',
        bio: 'Digital artist & AI Creator 🎨 Exploring the future of art.',
        followers: ['60c72b2f9b1d8b2badcf5002'],
        following: ['60c72b2f9b1d8b2badcf5001'],
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      }
    ];

    this.users.push(...usersList);

    // Mock Posts and Videos
    const postsList = [
      {
        _id: '60c72b2f9b1d8b2badcf5011',
        user: '60c72b2f9b1d8b2badcf5001',
        type: 'post',
        caption: 'Loving this sunset view by the beach! 🌅 #sunset #travel #vibes',
        hashtags: ['sunset', 'travel', 'vibes'],
        mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
        likes: ['60c72b2f9b1d8b2badcf5002', '60c72b2f9b1d8b2badcf5003'],
        comments: [
          {
            _id: '60c72b2f9b1d8b2badcf5021',
            user: '60c72b2f9b1d8b2badcf5002',
            text: 'Amazing shot, Aria! 📸',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          }
        ],
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        _id: '60c72b2f9b1d8b2badcf5012',
        user: '60c72b2f9b1d8b2badcf5002',
        type: 'short_video',
        caption: 'Strumming my favorite chords. 🎸 #guitar #music #live',
        hashtags: ['guitar', 'music', 'live'],
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        duration: 15,
        likes: ['60c72b2f9b1d8b2badcf5001'],
        comments: [],
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      },
      {
        _id: '60c72b2f9b1d8b2badcf5013',
        user: '60c72b2f9b1d8b2badcf5003',
        type: 'long_video',
        caption: 'Full documentary on AI Generated Art and the Future of Creation. 🎨🤖 #ai #art #design #future',
        hashtags: ['ai', 'art', 'design', 'future'],
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        duration: 596,
        likes: ['60c72b2f9b1d8b2badcf5001', '60c72b2f9b1d8b2badcf5002'],
        comments: [
          {
            _id: '60c72b2f9b1d8b2badcf5022',
            user: '60c72b2f9b1d8b2badcf5001',
            text: 'Very insightful video! Thanks for sharing.',
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          }
        ],
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      {
        _id: '60c72b2f9b1d8b2badcf5014',
        user: '60c72b2f9b1d8b2badcf5001',
        type: 'story',
        caption: 'Working from my favorite cafe today! ☕💻',
        mediaUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=400&q=80',
        expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000), // expires in 18 hours
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      }
    ];

    this.posts.push(...postsList);

    // Mock Messages
    const messagesList = [
      {
        _id: '60c72b2f9b1d8b2badcf5031',
        chatRoomId: '60c72b2f9b1d8b2badcf5001-60c72b2f9b1d8b2badcf5002',
        sender: '60c72b2f9b1d8b2badcf5002',
        text: 'Hey Aria! Are we still practicing tomorrow?',
        mediaType: 'text',
        readBy: ['60c72b2f9b1d8b2badcf5002', '60c72b2f9b1d8b2badcf5001'],
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        _id: '60c72b2f9b1d8b2badcf5032',
        chatRoomId: '60c72b2f9b1d8b2badcf5001-60c72b2f9b1d8b2badcf5002',
        sender: '60c72b2f9b1d8b2badcf5001',
        text: 'Yes Kabir! Let\'s meet at 4 PM in the studio.',
        mediaType: 'text',
        readBy: ['60c72b2f9b1d8b2badcf5001', '60c72b2f9b1d8b2badcf5002'],
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      },
      {
        _id: '60c72b2f9b1d8b2badcf5033',
        chatRoomId: '60c72b2f9b1d8b2badcf5001-60c72b2f9b1d8b2badcf5002',
        sender: '60c72b2f9b1d8b2badcf5002',
        text: 'Sounds perfect, see you there!',
        mediaType: 'text',
        readBy: ['60c72b2f9b1d8b2badcf5002'],
        createdAt: new Date(Date.now() - 19 * 60 * 60 * 1000),
      }
    ];

    this.messages.push(...messagesList);

    // Mock Live Streams
    const liveStreamsList = [
      {
        _id: '60c72b2f9b1d8b2badcf5041',
        host: '60c72b2f9b1d8b2badcf5002',
        title: 'Late Night Jam Session 🎵🎸',
        isLive: true,
        channelName: 'kabir_live',
        viewerCount: 142,
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      }
    ];

    this.liveStreams.push(...liveStreamsList);
    
    console.log('✅ Mock seed completed successfully!');
  }
};

module.exports = mockDb;
