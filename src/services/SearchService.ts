import searchRepository from '../repositories/SearchRepository';
import { formatPostResponse } from '../controllers/PostController';

export class SearchService {
  async search(userId: string, data: {
    query: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const query = data.query || '';
    const type = (data.type || 'all').toLowerCase();
    const page = data.page || 1;
    const limit = data.limit || 20;
    const offset = (page - 1) * limit;

    // Log query in background if not empty
    if (query.trim()) {
      searchRepository.createSearchLog(userId, query.trim()).catch(() => {});
    }

    if (type === 'users') {
      const usersList = await searchRepository.searchUsers(query, limit, offset);
      const users = usersList.map(u => ({
        _id: u.id,
        name: u.profile!.name,
        username: u.profile!.username,
        profilePic: u.profile!.profilePic,
        coverPic: u.profile!.coverPic,
        bio: u.profile!.bio,
      }));
      return { users };
    }

    if (type === 'posts' || type === 'reels' || type === 'videos') {
      const dbType = type === 'reels' ? 'REEL' : type === 'videos' ? 'VIDEOS' : undefined;
      const postsList = await searchRepository.searchPosts(query, dbType, limit, offset);
      const posts = postsList.map(p => formatPostResponse(p));
      return { posts };
    }

    if (type === 'hashtags') {
      const hashtagsList = await searchRepository.searchHashtags(query, limit, offset);
      const hashtags = hashtagsList.map(h => ({
        _id: h.id,
        name: h.name,
        postsCount: h._count.posts,
      }));
      return { hashtags };
    }

    // Type is 'all' - Fetch users, posts, and hashtags concurrently
    const [usersList, postsList, hashtagsList] = await Promise.all([
      searchRepository.searchUsers(query, limit, offset),
      searchRepository.searchPosts(query, undefined, limit, offset),
      searchRepository.searchHashtags(query, limit, offset),
    ]);

    return {
      users: usersList.map(u => ({
        _id: u.id,
        name: u.profile!.name,
        username: u.profile!.username,
        profilePic: u.profile!.profilePic,
      })),
      posts: postsList.map(p => formatPostResponse(p)),
      hashtags: hashtagsList.map(h => ({
        _id: h.id,
        name: h.name,
        postsCount: h._count.posts,
      })),
    };
  }

  async getRecent(userId: string) {
    const list = await searchRepository.getRecentSearches(userId);
    return list.map(item => ({
      _id: item.id,
      query: item.query,
      createdAt: item.createdAt,
    }));
  }

  async getTrending() {
    return searchRepository.getTrendingSearches();
  }

  async getSuggestions(query: string) {
    return searchRepository.getSuggestions(query);
  }
}

export default new SearchService();
