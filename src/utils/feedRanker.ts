import { FeedWeights } from '../config/constants';

export interface RankablePost {
  id: string;
  userId: string;
  createdAt: Date;
  originalPostId?: string | null;
  _count?: {
    likes?: number;
    comments?: number;
    views?: number;
  };
  // Fallbacks if counts are represented directly as arrays
  likes?: any[];
  comments?: any[];
  views?: any[];
}

/**
 * Computes the base engagement score using:
 * log(1 + likes) * 0.4 + log(1 + comments) * 0.3 + log(1 + views) * 0.1
 */
function getEngagementScore(post: RankablePost): number {
  const likes = post._count?.likes ?? post.likes?.length ?? 0;
  const comments = post._count?.comments ?? post.comments?.length ?? 0;
  const views = post._count?.views ?? post.views?.length ?? 0;

  return Math.log1p(likes) * 0.4 + Math.log1p(comments) * 0.3 + Math.log1p(views) * 0.1;
}

/**
 * Ranks a list of posts dynamically considering recency, engagement, relationships,
 * and diversity (author penalties to prevent duplicate consecutive posters).
 * 
 * Stable tie-breaker is applied on equal scores (sorting by createdAt desc, then id asc).
 */
export function rankPosts(
  posts: RankablePost[],
  viewerId: string,
  followingIds: string[] | Set<string>
): RankablePost[] {
  const followingSet = followingIds instanceof Set ? followingIds : new Set(followingIds);
  const now = Date.now();

  // 1. Calculate static base scores (recency + engagement + relationship)
  const baseScores = new Map<string, number>();

  for (const post of posts) {
    const ageHours = Math.max(0, (now - new Date(post.createdAt).getTime()) / 3600000);
    const recency = 1 / (1 + ageHours * 0.08);
    const engagement = getEngagementScore(post);
    const isFollowing = followingSet.has(post.userId) || post.userId === viewerId;
    const isOwnNewPost = post.userId === viewerId && ageHours < 0.25; // 15-minute new own post window

    const baseScore =
      recency * FeedWeights.RECENCY +
      engagement * FeedWeights.ENGAGEMENT +
      (isFollowing ? FeedWeights.RELATIONSHIP : 0) +
      (isOwnNewPost ? 10.0 : 0);

    baseScores.set(post.id, baseScore);
  }

  // 2. Iteratively select next post maximizing: baseScore - penalty
  const remaining = [...posts];
  const ranked: RankablePost[] = [];

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    // Stable sort helper: we iterate in order, so tie-breaking works on best index
    for (let i = 0; i < remaining.length; i++) {
      const post = remaining[i];
      const base = baseScores.get(post.id) ?? 0;

      // Diversity penalty: check if author is in the last 3 ranked posts
      let penalty = 0;
      const lastThree = ranked.slice(-3);
      const isDuplicateAuthor = lastThree.some(r => r.userId === post.userId);
      if (isDuplicateAuthor) {
        penalty = FeedWeights.DIVERSITY;
      }

      const score = base - penalty;

      // Stable comparison: choose higher score.
      // If equal, choose the one with larger score (or tie-break by date/id)
      let isBetter = score > bestScore;
      if (score === bestScore && bestIndex >= 0) {
        const bestPost = remaining[bestIndex];
        const dateA = new Date(post.createdAt).getTime();
        const dateB = new Date(bestPost.createdAt).getTime();
        if (dateA !== dateB) {
          isBetter = dateA > dateB; // newer post wins
        } else {
          isBetter = post.id < bestPost.id; // stable alphabetical id fallback
        }
      }

      if (isBetter) {
        bestScore = score;
        bestIndex = i;
      }
    }

    // Move best item to ranked list
    ranked.push(remaining[bestIndex]);
    remaining.splice(bestIndex, 1);
  }

  return ranked;
}

export default rankPosts;
