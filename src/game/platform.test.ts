import { describe, expect, it } from 'vitest';
import { shouldUseMobileMemorySafeAssets } from './platform';

describe('platform memory policy', () => {
  it('uses memory-safe assets for iPhone Safari and Chrome user agents', () => {
    const safari = {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
    };
    const chrome = {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
    };

    expect(shouldUseMobileMemorySafeAssets(safari)).toBe(true);
    expect(shouldUseMobileMemorySafeAssets(chrome)).toBe(true);
  });

  it('detects iPadOS desktop-style Safari', () => {
    expect(
      shouldUseMobileMemorySafeAssets({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('keeps desktop browsers on the requested asset quality', () => {
    expect(
      shouldUseMobileMemorySafeAssets({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        platform: 'Win32',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});
