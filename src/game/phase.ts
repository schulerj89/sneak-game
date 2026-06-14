import type { GamePhase } from './types';

export function isLoadingPhase(phase: GamePhase): boolean {
  return phase === 'loading';
}

export function isPlayingPhase(phase: GamePhase): boolean {
  return phase === 'playing';
}
