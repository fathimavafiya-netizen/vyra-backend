export function buildDraftUpdateData(dto: any) {
  // Whitelist editable fields and remove undefined values
  const {
    caption,
    mediaUrls,
    hashtags,
    location,
    taggedUserIds,
    scheduledAt,
    status,
  } = dto;

  const data: any = {};
  if (caption !== undefined) data.caption = caption;
  if (mediaUrls !== undefined) data.mediaUrls = mediaUrls;
  if (hashtags !== undefined) data.hashtags = hashtags;
  if (location !== undefined) data.location = location;
  if (taggedUserIds !== undefined) data.taggedUserIds = taggedUserIds;
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt;
  if (status !== undefined) data.status = status;
  return data;
}
