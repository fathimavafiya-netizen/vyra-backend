import prisma from '../config/db';

export class SearchRepository {
  async searchUsers(query: string, limit = 20, offset = 0) {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    return prisma.user.findMany({
      where: {
        OR: [
          { profile: { name: { contains: cleanQuery } } },
          { profile: { username: { contains: cleanQuery } } },
        ],
      },
      include: {
        profile: true,
      },
      take: limit,
      skip: offset,
    });
  }

  async searchPosts(query: string, type?: string, limit = 20, offset = 0) {
    const cleanQuery = query.trim().toLowerCase();
    const where: any = {};

    if (type) {
      const pType = type.toUpperCase();
      if (pType === 'VIDEOS') {
        where.type = { in: ['REEL', 'VIDEO'] };
      } else {
        let singleType = pType;
        if (singleType === 'SHORT_VIDEO') singleType = 'REEL';
        if (singleType === 'LONG_VIDEO') singleType = 'VIDEO';
        where.type = singleType;
      }
    } else {
      where.type = { not: 'STORY' }; // Exclude stories by default
    }

    if (cleanQuery) {
      const searchWord = cleanQuery.startsWith('#') ? cleanQuery.slice(1) : cleanQuery;
      if (searchWord) {
        where.OR = [
          { caption: { contains: cleanQuery } },
          { caption: { contains: searchWord } },
          { hashtags: { some: { hashtag: { name: { contains: searchWord } } } } },
          { user: { profile: { name: { contains: searchWord } } } },
          { user: { profile: { username: { contains: searchWord } } } },
        ];
      } else {
        // Just '#' was typed - show any post containing hashtags
        where.hashtags = { some: {} };
      }
    }

    return prisma.post.findMany({
      where,
      include: {
        media: { orderBy: { order: 'asc' } },
        user: { include: { profile: true } },
        likes: true,
        comments: {
          include: { user: { include: { profile: true } } },
        },
        originalPost: {
          include: {
            media: true,
            user: { include: { profile: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async searchHashtags(query: string, limit = 20, offset = 0) {
    const cleanQuery = query.trim().toLowerCase().replace('#', '');
    if (!cleanQuery) {
      // Return top hashtags when search input is empty or just '#'
      return prisma.hashtag.findMany({
        include: {
          _count: {
            select: { posts: true },
          },
        },
        orderBy: {
          posts: {
            _count: 'desc',
          },
        },
        take: limit,
        skip: offset,
      });
    }

    return prisma.hashtag.findMany({
      where: {
        name: { contains: cleanQuery },
      },
      include: {
        _count: {
          select: { posts: true },
        },
      },
      take: limit,
      skip: offset,
    });
  }

  async createSearchLog(userId: string, query: string) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return null;

    // Delete any existing log with the same query for this user to keep it fresh
    try {
      await prisma.searchHistory.deleteMany({
        where: { userId, query: cleanQuery },
      });
    } catch (e) {}

    return prisma.searchHistory.create({
      data: {
        userId,
        query: cleanQuery,
      },
    });
  }

  async getRecentSearches(userId: string, limit = 10) {
    return prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getTrendingSearches(limit = 10) {
    const result = await prisma.searchHistory.groupBy({
      by: ['query'],
      _count: {
        query: true,
      },
      orderBy: {
        _count: {
          query: 'desc',
        },
      },
      take: limit,
    });

    return result.map(r => r.query);
  }

  async getSuggestions(query: string, limit = 5) {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const suggestions: string[] = [];

    // 1. Match profile names & usernames
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { profile: { name: { contains: cleanQuery } } },
          { profile: { username: { contains: cleanQuery } } },
        ],
      },
      include: { profile: true },
      take: limit,
    });
    users.forEach(u => {
      if (u.profile) {
        suggestions.push(u.profile.username);
        suggestions.push(u.profile.name);
      }
    });

    // 2. Match hashtags
    const hashtags = await prisma.hashtag.findMany({
      where: { name: { contains: cleanQuery } },
      take: limit,
    });
    hashtags.forEach(h => suggestions.push(`#${h.name}`));

    // De-duplicate and return top suggestions
    return Array.from(new Set(suggestions)).slice(0, limit);
  }
}

export default new SearchRepository();
