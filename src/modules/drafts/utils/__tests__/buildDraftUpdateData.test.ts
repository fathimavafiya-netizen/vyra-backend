import { buildDraftUpdateData } from '../buildDraftUpdateData';

describe('buildDraftUpdateData', () => {
  it('removes immutable fields (userId, createdAt, status, version) due to whitelisting', () => {
    const dto = {
      userId: 'user-1',
      createdAt: new Date(),
      status: 'PUBLISHED',
      version: 2,
      caption: 'Valid caption',
    };
    const result = buildDraftUpdateData(dto);
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('version');
    expect(result.caption).toBe('Valid caption');
  });

  it('removes only undefined values', () => {
    const dto = {
      caption: 'Test',
      location: undefined,
      hashtags: undefined,
    };
    const result = buildDraftUpdateData(dto);
    expect(result).toHaveProperty('caption', 'Test');
    expect(result).not.toHaveProperty('location');
    expect(result).not.toHaveProperty('hashtags');
  });

  it('preserves valid falsy values (false, 0, "", [], null)', () => {
    const dto = {
      caption: '', 
      mediaUrls: [], 
      location: null, 
      hashtags: false as any, 
      taggedUserIds: 0 as any, 
    };
    const result = buildDraftUpdateData(dto);
    expect(result.caption).toBe('');
    expect(result.mediaUrls).toEqual([]);
    expect(result.location).toBeNull();
    expect(result.hashtags).toBe(false);
    expect(result.taggedUserIds).toBe(0);
  });
  
  it('removes unexpected properties not in the whitelist', () => {
    const dto = {
      caption: 'Test',
      someRandomField: 'random',
    };
    const result = buildDraftUpdateData(dto);
    expect(result).not.toHaveProperty('someRandomField');
    expect(result).toHaveProperty('caption');
  });
});
