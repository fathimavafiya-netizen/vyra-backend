/**
 * Vyra — shared status constants
 * Using `as const` objects instead of Prisma enums for SQLite compatibility.
 * Migrate to proper Prisma enums when moving to PostgreSQL in Phase 5.
 */

export const MessageStatus = {
  SENT:      'SENT',
  DELIVERED: 'DELIVERED',
  READ:      'READ',
} as const;
export type MessageStatus = typeof MessageStatus[keyof typeof MessageStatus];

export const CallStatus = {
  RINGING:   'RINGING',
  ANSWERED:  'ANSWERED',
  MISSED:    'MISSED',
  REJECTED:  'REJECTED',
  CANCELLED: 'CANCELLED',
  ENDED:     'ENDED',
} as const;
export type CallStatus = typeof CallStatus[keyof typeof CallStatus];

export const NotificationType = {
  FOLLOW:          'FOLLOW',
  FOLLOW_REQUEST:  'FOLLOW_REQUEST',
  FOLLOW_ACCEPTED: 'FOLLOW_ACCEPTED',
  LIKE:            'LIKE',
  COMMENT:         'COMMENT',
  MENTION:         'MENTION',
  NEW_MESSAGE:     'NEW_MESSAGE',
  MISSED_CALL:     'MISSED_CALL',
  CALL_ENDED:      'CALL_ENDED',
  GROUP_INVITE:    'GROUP_INVITE',
  STORY_REACTION:  'STORY_REACTION',
  SYSTEM:          'SYSTEM',
  // Newly added for complete routing
  COMMENT_REPLY:   'COMMENT_REPLY',
  POST_REPOST:     'POST_REPOST',
  STORY_LIKE:      'STORY_LIKE',
  STORY_REPLY:     'STORY_REPLY',
  LIVE_STARTED:    'LIVE_STARTED',
} as const;
export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

export const MemberRole = {
  MEMBER: 'MEMBER',
  ADMIN:  'ADMIN',
} as const;
export type MemberRole = typeof MemberRole[keyof typeof MemberRole];

// Heartbeat interval (ms) — clients should ping this often to stay "online"
export const PRESENCE_HEARTBEAT_MS = 30_000;

// Call ring timeout before auto-MISSED (ms)
export const CALL_RING_TIMEOUT_MS = 30_000;

// Configurable weights for home feed ranking
export const FeedWeights = {
  RECENCY:      0.40,
  ENGAGEMENT:   0.40,
  RELATIONSHIP: 0.15,
  DIVERSITY:    0.05,
} as const;

// User Roles
export const UserRole = {
  USER:      'USER',
  MODERATOR: 'MODERATOR',
  ADMIN:     'ADMIN',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

// Granular channels for push notifications
export const NotificationChannel = {
  MESSAGE:  'MESSAGE',
  CALL:     'CALL',
  FOLLOW:   'FOLLOW',
  LIKE:     'LIKE',
  COMMENT:  'COMMENT',
  MENTION:  'MENTION',
  SYSTEM:   'SYSTEM',
} as const;
export type NotificationChannel = typeof NotificationChannel[keyof typeof NotificationChannel];

