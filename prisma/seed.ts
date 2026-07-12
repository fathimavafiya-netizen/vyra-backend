import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean all existing tables to prevent foreign key errors during re-seeds
  await prisma.followRequest.deleteMany();
  await prisma.searchHistory.deleteMany();
  await prisma.report.deleteMany();
  await prisma.aiHistory.deleteMany();
  await prisma.liveStream.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.messageRead.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.postHashtag.deleteMany();
  await prisma.hashtag.deleteMany();
  await prisma.savedPost.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.media.deleteMany();
  await prisma.story.deleteMany();
  await prisma.post.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.muteUser.deleteMany();
  await prisma.blockedUser.deleteMany();
  await prisma.refreshTokenAudit.deleteMany();
  await prisma.device.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.template.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing database tables.');

  // Hash standard password for seeds
  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Create Users
  const userAria = await prisma.user.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5001',
      email: 'aria@vyra.com',
      mobile: '+919876543210',
      password: hashedPassword,
      profile: {
        create: {
          name: 'Aria Sharma',
          username: 'aria_sharma',
          bio: 'Sunset chaser 🌅 | Creating vibes & sharing stories 💫 Travel | Tech',
          profilePic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
          coverPic: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&h=300&q=80',
        },
      },
      settings: {
        create: {
          isPrivate: false,
          darkMode: true,
          likesEnabled: true,
          commentsEnabled: true,
          followersEnabled: true,
          messagesEnabled: true,
          mentionsEnabled: true,
          aiEnabled: true,
        },
      },
    },
  });

  const userKabir = await prisma.user.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5002',
      email: 'kabir@vyra.com',
      mobile: '+919999888877',
      password: hashedPassword,
      profile: {
        create: {
          name: 'Kabir Verma',
          username: 'kabir_verma',
          bio: "Sunset music sessions 🎸 | Singer-songwriter. Let's connect!",
          profilePic: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
          coverPic: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&h=300&q=80',
        },
      },
      settings: {
        create: {
          isPrivate: false,
          darkMode: true,
          likesEnabled: true,
          commentsEnabled: true,
          followersEnabled: true,
          messagesEnabled: true,
          mentionsEnabled: true,
          aiEnabled: true,
        },
      },
    },
  });

  const userZara = await prisma.user.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5003',
      email: 'zara@vyra.com',
      mobile: '+12025550143',
      password: hashedPassword,
      profile: {
        create: {
          name: 'Zara Taylor',
          username: 'zara_taylor',
          bio: 'Digital artist & AI Creator 🎨 Exploring art in the rain 🌧️',
          profilePic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
          coverPic: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&h=300&q=80',
        },
      },
      settings: {
        create: {
          isPrivate: false,
          darkMode: true,
          likesEnabled: true,
          commentsEnabled: true,
          followersEnabled: true,
          messagesEnabled: true,
          mentionsEnabled: true,
          aiEnabled: true,
        },
      },
    },
  });

  const userRohan = await prisma.user.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5004',
      email: 'rohan@vyra.com',
      mobile: '+919876500004',
      password: hashedPassword,
      profile: {
        create: {
          name: 'Rohan Sen',
          username: 'rohan_vlogs',
          bio: 'Wanderer 🌏 | Friendship traveler | Catching cinematic moments 📸',
          profilePic: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&h=150&q=80',
          coverPic: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&h=300&q=80',
        },
      },
      settings: { create: { isPrivate: false, darkMode: true, likesEnabled: true, commentsEnabled: true } }
    }
  });

  const userElena = await prisma.user.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5005',
      email: 'elena@vyra.com',
      mobile: '+79876543210',
      password: hashedPassword,
      profile: {
        create: {
          name: 'Elena Rostova',
          username: 'elena_dance',
          bio: 'Dancing in the rain 💃🌧️ | Motion Graphic Designer 🎬 | Coffee lover ☕',
          profilePic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
          coverPic: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&h=300&q=80',
        },
      },
      settings: { create: { isPrivate: false, darkMode: true, likesEnabled: true, commentsEnabled: true } }
    }
  });

  const userVikram = await prisma.user.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5006',
      email: 'vikram@vyra.com',
      mobile: '+919876500006',
      password: hashedPassword,
      profile: {
        create: {
          name: 'Vikram Malhotra',
          username: 'vikram_beats',
          bio: 'Sunset lo-fi frequencies 🎧🌅 | Sound Engineering | Sleep tunes 🌙',
          profilePic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
          coverPic: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&h=300&q=80',
        },
      },
      settings: { create: { isPrivate: false, darkMode: true, likesEnabled: true, commentsEnabled: true } }
    }
  });

  const userMaya = await prisma.user.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5007',
      email: 'maya@vyra.com',
      mobile: '+12025550177',
      password: hashedPassword,
      profile: {
        create: {
          name: 'Maya Patel',
          username: 'maya_writes',
          bio: 'Rain drops and poetry 🌧️📝 | Storyteller | Spreading truths ✨',
          profilePic: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
          coverPic: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&h=300&q=80',
        },
      },
      settings: { create: { isPrivate: false, darkMode: true, likesEnabled: true, commentsEnabled: true } }
    }
  });

  const userArjun = await prisma.user.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5008',
      email: 'arjun@vyra.com',
      mobile: '+919876500008',
      password: hashedPassword,
      profile: {
        create: {
          name: 'Arjun Mehta',
          username: 'arjun_mehta',
          bio: 'Friendship filmmaker & Photographer 📸 | Capturing life in 24 frames 🎞️',
          profilePic: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
          coverPic: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&h=300&q=80',
        },
      },
      settings: { create: { isPrivate: false, darkMode: true, likesEnabled: true, commentsEnabled: true } }
    }
  });

  const userMeera = await prisma.user.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5009',
      email: 'meera@vyra.com',
      mobile: '+919876500009',
      password: hashedPassword,
      profile: {
        create: {
          name: 'Meera Nair',
          username: 'meera_cooks',
          bio: 'Baking under a sunset sky 🥐🌅 | Pastry Chef 👩‍🍳 | Regional flavors',
          profilePic: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80',
          coverPic: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&h=300&q=80',
        },
      },
      settings: { create: { isPrivate: false, darkMode: true, likesEnabled: true, commentsEnabled: true } }
    }
  });

  const userDev = await prisma.user.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5010',
      email: 'dev@vyra.com',
      mobile: '+919876500010',
      password: hashedPassword,
      profile: {
        create: {
          name: 'Dev Kumar',
          username: 'dev_codes',
          bio: 'Rainy day coder ☕🌧️ | Fullstack Dev 💻 | AI explorer',
          profilePic: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&h=150&q=80',
          coverPic: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&h=300&q=80',
        },
      },
      settings: { create: { isPrivate: false, darkMode: true, likesEnabled: true, commentsEnabled: true } }
    }
  });

  console.log('👤 Created users and profiles.');

  // 2. Create Follows
  await prisma.follow.createMany({
    data: [
      { followerId: userAria.id, followingId: userKabir.id },
      { followerId: userKabir.id, followingId: userAria.id },
      { followerId: userKabir.id, followingId: userZara.id },
      { followerId: userZara.id, followingId: userAria.id },
      { followerId: userRohan.id, followingId: userAria.id },
      { followerId: userAria.id, followingId: userRohan.id },
      { followerId: userElena.id, followingId: userVikram.id },
      { followerId: userVikram.id, followingId: userElena.id },
      { followerId: userMaya.id, followingId: userZara.id },
      { followerId: userAria.id, followingId: userArjun.id },
      { followerId: userAria.id, followingId: userMeera.id },
      { followerId: userAria.id, followingId: userDev.id },
      { followerId: userArjun.id, followingId: userAria.id },
      { followerId: userMeera.id, followingId: userAria.id },
      { followerId: userDev.id, followingId: userAria.id },
      // Establish follow relationships from Aria to all other users to render their stories
      { followerId: userAria.id, followingId: userZara.id },
      { followerId: userAria.id, followingId: userElena.id },
      { followerId: userAria.id, followingId: userVikram.id },
      { followerId: userAria.id, followingId: userMaya.id },
    ],
  });
  console.log('🔗 Created follower relationships.');

  // 3. Create/Retrieve Hashtags
  const hashtagsMap = new Map<string, any>();
  const hashtagNames = [
    'sunset', 'travel', 'vibes', 'music', 'guitar', 'ai', 'art', 
    'travelvlog', 'dance', 'motiongraphics', 'beatmaker', 'poetry', 
    'cinematic', 'rain', 'friendship'
  ];
  for (const name of hashtagNames) {
    const hashtag = await prisma.hashtag.create({ data: { name } });
    hashtagsMap.set(name, hashtag);
  }

  // 4. Create Posts list (10 videos per category: rain, sunset, friendship)
  const postsToCreate = [
    // --- RAIN (10 videos) ---
    {
      id: 'rain_post_1',
      caption: 'Nothing beats a hot cup of coffee on a cozy rainy day. ☕🌧️ #rain #vibes',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['rain', 'vibes'],
    },
    {
      id: 'rain_post_2',
      caption: 'Walking down the wet streets of Tokyo in the rain. ☔🏙️ #rain #travel',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      mediaType: 'VIDEO',
      duration: 20,
      tags: ['rain', 'travel'],
    },
    {
      id: 'rain_post_3',
      caption: 'Listen to the rhythm of the falling rain. 🎧🌧️ #rain #vibes #music',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['rain', 'vibes', 'music'],
    },
    {
      id: 'rain_post_4',
      caption: 'Rainy afternoon mood. Perfect time to read a book. 📖🌧️ #rain #poetry',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      mediaType: 'VIDEO',
      duration: 596,
      tags: ['rain', 'poetry'],
    },
    {
      id: 'rain_post_5',
      caption: 'Raindrops falling on my window pane. 🌧️✨ #rain #vibes',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      mediaType: 'VIDEO',
      duration: 30,
      tags: ['rain', 'vibes'],
    },
    {
      id: 'rain_post_6',
      caption: 'Dancing in the rain like nobody is watching! 💃🌧️ #rain #dance',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      mediaType: 'VIDEO',
      duration: 20,
      tags: ['rain', 'dance'],
    },
    {
      id: 'rain_post_7',
      caption: 'The smell of wet soil after a heavy rain shower. 🌱🌧️ #rain #vibes',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['rain', 'vibes'],
    },
    {
      id: 'rain_post_8',
      caption: 'Monsoon vibes in Mumbai. Heavy rain and hot chai. ☕🌧️ #rain #vibes',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      mediaType: 'VIDEO',
      duration: 25,
      tags: ['rain', 'vibes'],
    },
    {
      id: 'rain_post_9',
      caption: 'Neon lights reflecting on wet rainy streets. 🌃☔ #rain #cinematic',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['rain', 'cinematic'],
    },
    {
      id: 'rain_post_10',
      caption: 'A rainy escape into the misty pine forests. 🌲🌧️ #rain #travel',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      mediaType: 'VIDEO',
      duration: 60,
      tags: ['rain', 'travel'],
    },

    // --- SUNSET (10 videos) ---
    {
      id: '60c72b2f9b1d8b2badcf5111',
      caption: 'Loving this sunset view by the beach! 🌅 #sunset #travel #vibes',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      mediaType: 'VIDEO',
      duration: 45,
      tags: ['sunset', 'travel', 'vibes'],
    },
    {
      id: 'sunset_post_2',
      caption: 'Golden hour hits different in Santorini. 🇬🇷🌅 #sunset #travel',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      mediaType: 'VIDEO',
      duration: 52,
      tags: ['sunset', 'travel'],
    },
    {
      id: 'sunset_post_3',
      caption: 'Chasing sunsets in the desert dunes. 🏜️✨ #sunset #travel #vibes',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      mediaType: 'VIDEO',
      duration: 596,
      tags: ['sunset', 'travel', 'vibes'],
    },
    {
      id: 'sunset_post_4',
      caption: 'An epic sunset behind the city skyline. 🏙️🌇 #sunset #cinematic',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['sunset', 'cinematic'],
    },
    {
      id: 'sunset_post_5',
      caption: 'Sunsets are proof that endings can be beautiful too. 🌅💫 #sunset #vibes',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      mediaType: 'VIDEO',
      duration: 20,
      tags: ['sunset', 'vibes'],
    },
    {
      id: 'sunset_post_6',
      caption: 'Cotton candy skies at dusk. 🦄🌅 #sunset #vibes',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['sunset', 'vibes'],
    },
    {
      id: 'sunset_post_7',
      caption: 'Watching the sunset from the top of the mountain. ⛰️🌅 #sunset #travel',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      mediaType: 'VIDEO',
      duration: 120,
      tags: ['sunset', 'travel'],
    },
    {
      id: 'sunset_post_8',
      caption: 'Sunset sailing across the blue ocean. ⛵🌅 #sunset #travel',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      mediaType: 'VIDEO',
      duration: 30,
      tags: ['sunset', 'travel'],
    },
    {
      id: 'sunset_post_9',
      caption: 'Golden hour picnic with a sunset view. 🧺🌅 #sunset #vibes',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      mediaType: 'VIDEO',
      duration: 52,
      tags: ['sunset', 'vibes'],
    },
    {
      id: 'sunset_post_10',
      caption: 'A quiet evening watching the sun go down. 🧘🌅 #sunset #vibes',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['sunset', 'vibes'],
    },

    // --- FRIENDSHIP (10 videos) ---
    {
      id: 'friendship_post_1',
      caption: 'Friends who travel together, stay together! ✈️👯 #friendship #travel',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      mediaType: 'VIDEO',
      duration: 20,
      tags: ['friendship', 'travel'],
    },
    {
      id: 'friendship_post_2',
      caption: 'Road trip adventures with my best friends! 🚗💨 #friendship #travel',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      mediaType: 'VIDEO',
      duration: 52,
      tags: ['friendship', 'travel'],
    },
    {
      id: 'friendship_post_3',
      caption: 'Late night conversations and endless laughter. ❤️👯 #friendship #vibes',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['friendship', 'vibes'],
    },
    {
      id: 'friendship_post_4',
      caption: 'Celebrating years of friendship and shared memories. 🥂✨ #friendship #vibes',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      mediaType: 'VIDEO',
      duration: 300,
      tags: ['friendship', 'vibes'],
    },
    {
      id: 'friendship_post_5',
      caption: 'Best friends make good times better and hard times easier. 🤝❤️ #friendship',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      mediaType: 'VIDEO',
      duration: 35,
      tags: ['friendship'],
    },
    {
      id: 'friendship_post_6',
      caption: 'Weekend brunch with my favorite people! 🥞☕ #friendship #vibes',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['friendship', 'vibes'],
    },
    {
      id: 'friendship_post_7',
      caption: 'Concert nights with the best squad ever! 🎶🎸 #friendship #music',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      mediaType: 'VIDEO',
      duration: 20,
      tags: ['friendship', 'music'],
    },
    {
      id: 'friendship_post_8',
      caption: 'Picnic in the park with friends. 🧺🌳 #friendship #vibes',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['friendship', 'vibes'],
    },
    {
      id: 'friendship_post_9',
      caption: 'Always there to lift each other up. 🤝💫 #friendship #vibes',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      mediaType: 'VIDEO',
      duration: 40,
      tags: ['friendship', 'vibes'],
    },
    {
      id: 'friendship_post_10',
      caption: 'Grateful for the friends who became family. ❤️👯 #friendship',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      mediaType: 'VIDEO',
      duration: 52,
      tags: ['friendship'],
    },

    // --- OTHER ORIGINAL POSTS ---
    {
      id: '60c72b2f9b1d8b2badcf5112',
      caption: 'Strumming my favorite chords. 🎸 #guitar #music',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['guitar', 'music'],
    },
    {
      id: '60c72b2f9b1d8b2badcf5113',
      caption: 'Full documentary on AI Generated Art and the Future of Creation. 🎨🤖 #ai #art',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      mediaType: 'VIDEO',
      duration: 596,
      tags: ['ai', 'art'],
    },
    {
      id: '60c72b2f9b1d8b2badcf5114',
      caption: 'Hiking through the deep valleys of Manali. ⛰️🥾 #travelvlog #travel #cinematic',
      type: 'VIDEO',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      mediaType: 'VIDEO',
      duration: 52,
      tags: ['travelvlog', 'travel', 'cinematic'],
    },
    {
      id: '60c72b2f9b1d8b2badcf5115',
      caption: 'Free styling to some electronic synth beats. 💃🔥 #dance #motiongraphics',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      mediaType: 'VIDEO',
      duration: 20,
      tags: ['dance', 'motiongraphics'],
    },
    {
      id: '60c72b2f9b1d8b2badcf5116',
      caption: 'Cooking up some lofi tunes to sleep to. 🎹🌙 #beatmaker #music #vibes',
      type: 'REEL',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      mediaType: 'VIDEO',
      duration: 15,
      tags: ['beatmaker', 'music', 'vibes'],
    },
    {
      id: '60c72b2f9b1d8b2badcf5117',
      caption: 'Whispers of the forest. The trees speak in verses. 🌲📖 #poetry #vibes',
      type: 'POST',
      url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80',
      mediaType: 'IMAGE',
      tags: ['poetry', 'vibes'],
    },
  ];

  const creators = [
    userAria, userKabir, userZara, userRohan, userElena, 
    userVikram, userMaya, userArjun, userMeera, userDev
  ];

  for (let i = 0; i < postsToCreate.length; i++) {
    const p = postsToCreate[i];
    let creator = creators[i % creators.length];
    if (p.id === '60c72b2f9b1d8b2badcf5111') creator = userAria;
    else if (p.id === '60c72b2f9b1d8b2badcf5112') creator = userKabir;
    else if (p.id === '60c72b2f9b1d8b2badcf5113') creator = userZara;
    else if (p.id === '60c72b2f9b1d8b2badcf5114') creator = userRohan;
    else if (p.id === '60c72b2f9b1d8b2badcf5115') creator = userElena;
    else if (p.id === '60c72b2f9b1d8b2badcf5116') creator = userVikram;
    else if (p.id === '60c72b2f9b1d8b2badcf5117') creator = userMaya;

    await prisma.post.create({
      data: {
        id: p.id,
        userId: creator.id,
        type: p.type as any,
        caption: p.caption,
        media: {
          create: {
            userId: creator.id,
            url: p.url,
            type: p.mediaType as any,
            duration: p.duration || 0,
          },
        },
        hashtags: {
          create: p.tags.map(tagName => ({
            hashtagId: hashtagsMap.get(tagName)!.id,
          })),
        },
      },
    });
  }

  console.log('📝 Created posts, reels, and video records with media attachments.');

  // 5. Create Comments & Likes
  await prisma.like.createMany({
    data: [
      { postId: '60c72b2f9b1d8b2badcf5111', userId: userKabir.id },
      { postId: '60c72b2f9b1d8b2badcf5111', userId: userZara.id },
      { postId: '60c72b2f9b1d8b2badcf5112', userId: userAria.id },
      { postId: '60c72b2f9b1d8b2badcf5113', userId: userAria.id },
      { postId: '60c72b2f9b1d8b2badcf5113', userId: userKabir.id },
    ],
  });

  await prisma.comment.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5021',
      postId: '60c72b2f9b1d8b2badcf5111',
      userId: userKabir.id,
      text: 'Amazing shot, Aria! 📸',
    },
  });
  console.log('💬 Added comments and likes.');

  // 6. Create Story
  const storiesData = [
    {
      id: 'story_aria',
      userId: userAria.id,
      caption: 'Today is a wonderful day! ☀️',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'story_kabir',
      userId: userKabir.id,
      caption: 'Late night jam sessions 🎸',
      url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'story_zara',
      userId: userZara.id,
      caption: 'Synthesizing neural assets 🎨',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'story_rohan',
      userId: userRohan.id,
      caption: 'Waking up above the clouds ⛰️',
      url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'story_elena',
      userId: userElena.id,
      caption: 'Dance is the language of the soul 💃',
      url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'story_vikram',
      userId: userVikram.id,
      caption: 'Crafting lo-fi frequencies 🎹',
      url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'story_maya',
      userId: userMaya.id,
      caption: 'Finding peace in pages 📖',
      url: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'story_arjun',
      userId: userArjun.id,
      caption: 'Behind the scenes camera setup 🎥',
      url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'story_meera',
      userId: userMeera.id,
      caption: 'Freshly baked croissants ready! 🥐',
      url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'story_dev',
      userId: userDev.id,
      caption: 'Coffee is compiled successfully ☕',
      url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=400&q=80',
    },
  ];

  for (const s of storiesData) {
    await prisma.story.create({
      data: {
        id: s.id,
        userId: s.userId,
        caption: s.caption,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        media: {
          create: {
            userId: s.userId,
            url: s.url,
            type: 'IMAGE',
          },
        },
      },
    });
  }
  console.log('📖 Created stories.');

  // 7. Create Chat Conversation
  const conversation = await prisma.conversation.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5041',
      isGroup: false,
      members: {
        create: [
          { userId: userAria.id, role: 'MEMBER' },
          { userId: userKabir.id, role: 'MEMBER' },
        ],
      },
    },
  });

  await prisma.message.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5051',
      conversationId: conversation.id,
      senderId: userKabir.id,
      text: 'Hey Aria! Did you see the new AI filter design?',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  const msg2 = await prisma.message.create({
    data: {
      id: '60c72b2f9b1d8b2badcf5052',
      conversationId: conversation.id,
      senderId: userAria.id,
      text: "Yes, Kabir! It looks stunning. Let's record a reel together soon.",
      createdAt: new Date(Date.now() - 15 * 60 * 1000),
    },
  });

  // Mark message read
  await prisma.messageRead.create({
    data: {
      messageId: msg2.id,
      userId: userKabir.id,
    },
  });

  console.log('💬 Created conversation history and direct messages.');

  // 8. Templates
  await prisma.template.createMany({
    data: [
      {
        id: 'tmpl_1',
        title: 'Retro Aesthetic Film',
        mediaUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=300&q=80',
        category: 'Aesthetic',
      },
      {
        id: 'tmpl_2',
        title: 'Synthwave Neon Beats',
        mediaUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&q=80',
        category: 'Music',
      },
    ],
  });
  console.log('🎨 Seeded template gallery.');

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
