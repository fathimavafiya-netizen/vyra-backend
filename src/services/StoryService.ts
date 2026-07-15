import storyRepository from '../repositories/StoryRepository';
import { MediaType } from '../repositories/PostRepository';
import uploadService from './UploadService';
import fs from 'fs';
import path from 'path';
import storageProvider from '../security/StorageProvider';

export class StoryService {
  // ─── Stories ────────────────────────────────────────────────────────────────

  async createStory(data: {
    userId: string;
    caption?: string;
    mediaUrl: string;
    mediaType?: 'IMAGE' | 'VIDEO';
    thumbnailUrl?: string;
    duration?: number;
    isCloseFriends?: boolean;
    filterApplied?: string;
    textOverlays?: string;
    stickers?: string;
    musicTrackId?: string;
    mentionedUserIds?: string[];
  }) {
    const mType = data.mediaType === 'VIDEO' ? MediaType.VIDEO : MediaType.IMAGE;
    return storyRepository.createStory({
      ...data,
      mediaType: mType,
    });
  }

  async getFeedStories(viewerId: string) {
    const stories = await storyRepository.getActiveStories(viewerId);

    // Group stories by user so the front-end can render story rings
    const grouped: Record<string, {
      user: any;
      stories: typeof stories;
      hasUnseen: boolean;
    }> = {};

    for (const story of stories) {
      const uid = story.userId;
      if (!grouped[uid]) {
        grouped[uid] = { user: story.user, stories: [], hasUnseen: false };
      }
      grouped[uid].stories.push(story);
      // Mark as unseen if the viewer hasn't viewed this story yet
      const seen = story.views.some((v: any) => v.userId === viewerId);
      if (!seen) grouped[uid].hasUnseen = true;
    }

    return Object.values(grouped);
  }

  async getArchive(userId: string) {
    return storyRepository.getArchivedStories(userId);
  }

  async deleteStory(storyId: string, userId: string) {
    const story = await storyRepository.deleteStory(storyId, userId);
    // Perform cloud cleanup
    if (story && story.media && story.media.length > 0) {
      for (const m of story.media) {
        if (m.url) {
          await storageProvider.deleteFile(m.url).catch(err => {
            console.error(`[StoryService] Failed to delete file ${m.url}: ${err.message}`);
          });
        }
      }
    }
    return story;
  }

  async likeStory(storyId: string, userId: string) {
    return storyRepository.likeStory(storyId, userId);
  }

  async unlikeStory(storyId: string, userId: string) {
    return storyRepository.unlikeStory(storyId, userId);
  }

  async getStoryInteractions(storyId: string, viewerId: string, options: { cursor?: string; limit?: number }) {
    return storyRepository.getStoryInteractions(storyId, viewerId, options);
  }

  // ─── Views & Reactions ──────────────────────────────────────────────────────

  async viewStory(storyId: string, viewerId: string) {
    return storyRepository.addView(storyId, viewerId);
  }

  async reactToStory(storyId: string, userId: string, emoji: string) {
    if (!emoji || emoji.length > 8) throw new Error('Invalid emoji.');
    return storyRepository.upsertReaction(storyId, userId, emoji);
  }

  async removeReaction(storyId: string, userId: string) {
    return storyRepository.removeReaction(storyId, userId);
  }

  // ─── Highlights ─────────────────────────────────────────────────────────────

  async createHighlight(userId: string, title: string, coverUrl: string) {
    if (!title.trim()) throw new Error('Highlight title cannot be empty.');
    return storyRepository.createHighlight(userId, title.trim(), coverUrl);
  }

  async getHighlights(userId: string) {
    return storyRepository.getHighlights(userId);
  }

  async addStoryToHighlight(highlightId: string, storyId: string, userId: string) {
    return storyRepository.addStoryToHighlight(highlightId, storyId, userId);
  }

  async removeStoryFromHighlight(highlightId: string, storyId: string, userId: string) {
    return storyRepository.removeStoryFromHighlight(highlightId, storyId, userId);
  }

  async deleteHighlight(highlightId: string, userId: string) {
    return storyRepository.deleteHighlight(highlightId, userId);
  }

  // ─── Close Friends ──────────────────────────────────────────────────────────

  async addCloseFriend(ownerId: string, friendId: string) {
    return storyRepository.addCloseFriend(ownerId, friendId);
  }

  async removeCloseFriend(ownerId: string, friendId: string) {
    return storyRepository.removeCloseFriend(ownerId, friendId);
  }

  async getCloseFriends(ownerId: string) {
    return storyRepository.getCloseFriends(ownerId);
  }

  // ─── Reels ──────────────────────────────────────────────────────────────────

  async getReelsFeed(viewerId: string, cursor?: string, limit?: number) {
    return storyRepository.getReelsFeed(viewerId, { cursor, limit });
  }

  async registerPostView(postId: string, userId: string) {
    return storyRepository.registerPostView(postId, userId);
  }
}

export default new StoryService();
