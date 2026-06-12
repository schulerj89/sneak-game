import { describe, expect, it } from 'vitest';
import { soundtrackOptions } from './audio';

describe('soundtrack metadata', () => {
  it('keeps every track source and license auditable', () => {
    for (const track of soundtrackOptions) {
      expect.soft(track.id).toBeTruthy();
      expect.soft(track.name).toBeTruthy();
      expect.soft(track.tempoBpm).toBeGreaterThan(0);
      expect.soft(track.source.license).toBeTruthy();
      expect.soft(track.source.sourceUrl).toBeTruthy();
      expect.soft(track.source.attribution).toBeTruthy();
    }
  });

  it('includes a compressed replacement candidate', () => {
    const replacement = soundtrackOptions.find((track) => track.id === 'metro-escape');
    expect(replacement?.name).toBe('Metro Escape');
    expect(replacement?.url).toContain('.mp3');
    expect(replacement?.tempoBpm).toBeGreaterThan(160);
  });
});
