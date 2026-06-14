import { describe, expect, it } from 'vitest';
import { soundtrackOptions } from './audio';

describe('soundtrack metadata', () => {
  it('keeps every track source and license auditable', () => {
    for (const track of soundtrackOptions) {
      expect.soft(track.id).toBeTruthy();
      expect.soft(track.name).toBeTruthy();
      expect.soft(track.tempoBpm).toBeGreaterThan(0);
      expect.soft(track.source.kind).toBe('external');
      expect.soft(track.source.license).toBeTruthy();
      expect.soft(track.source.sourceUrl).toBeTruthy();
      expect.soft(track.source.attribution).toBeTruthy();
    }
  });

  it('only exposes downloaded external tracks', () => {
    expect(soundtrackOptions.map((track) => track.id)).toEqual([
      'ghost-steps',
      'cyberpunk-moonlight',
      'dark-sci-fi-sector',
      'dark-sci-fi-pulse',
      'dark-sci-fi-urgent',
    ]);
  });

  it('includes the external cyberpunk selection', () => {
    const cyberpunk = soundtrackOptions.find((track) => track.id === 'cyberpunk-moonlight');
    expect(cyberpunk?.name).toBe('Cyberpunk Moonlight');
    expect(cyberpunk?.url).toContain('.mp3');
    expect(cyberpunk?.source.license).toBe('CC0');
    expect(cyberpunk?.source.sourceUrl).toContain('opengameart.org/content/cyberpunk-moonlight-sonata');
  });

  it('uses the external stealth track as the default option', () => {
    expect(soundtrackOptions[0]?.id).toBe('ghost-steps');
    expect(soundtrackOptions[0]?.name).toBe('Ghost Steps');
    expect(soundtrackOptions[0]?.url).toContain('.mp3');
    expect(soundtrackOptions[0]?.source.license).toBe('CC-BY 4.0');
  });

  it('includes the new CC0 dark sci-fi tracks', () => {
    const darkSciFiTracks = soundtrackOptions.filter((track) => track.id.startsWith('dark-sci-fi-'));
    expect(darkSciFiTracks).toHaveLength(3);
    for (const track of darkSciFiTracks) {
      expect.soft(track.url).toContain('.mp3');
      expect.soft(track.source.license).toBe('CC0');
      expect.soft(track.source.sourceUrl).toContain('opengameart.org/content/dark-sci-fi-audio-pack');
    }
  });
});
