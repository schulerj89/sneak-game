import shadowOperativeIdleUrl from '../assets/hero/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb?url';
import shadowOperativeRunUrl from '../assets/hero/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb?url';
import echoVanguardIdleUrl from '../assets/hero/hero_2/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb?url';
import echoVanguardRunUrl from '../assets/hero/hero_2/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb?url';
import signalWardenIdleUrl from '../assets/hero/hero_3/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb?url';
import signalWardenRunUrl from '../assets/hero/hero_3/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb?url';
import circuitNomadIdleUrl from '../assets/hero/hero_4/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb?url';
import circuitNomadRunUrl from '../assets/hero/hero_4/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb?url';

export const heroOptions = [
  {
    id: 'shadow-operative',
    name: 'Shadow Operative',
    role: 'Balanced infiltrator',
    description: 'Original low-profile field suit with stable movement reads.',
    accentColor: '#53ffe2',
    idleUrl: shadowOperativeIdleUrl,
    runUrl: shadowOperativeRunUrl,
  },
  {
    id: 'echo-vanguard',
    name: 'Echo Vanguard',
    role: 'Heavy recon kit',
    description: 'Bulkier silhouette for players who want a stronger tactical read.',
    accentColor: '#7dfcc6',
    idleUrl: echoVanguardIdleUrl,
    runUrl: echoVanguardRunUrl,
  },
  {
    id: 'signal-warden',
    name: 'Signal Warden',
    role: 'Fast response suit',
    description: 'Brightest profile in the roster with the same stealth footprint.',
    accentColor: '#5ad7ff',
    idleUrl: signalWardenIdleUrl,
    runUrl: signalWardenRunUrl,
  },
  {
    id: 'circuit-nomad',
    name: 'Circuit Nomad',
    role: 'Adaptive scout',
    description: 'Newest field suit with a sharp silhouette and the same tuned animations.',
    accentColor: '#ffd45a',
    idleUrl: circuitNomadIdleUrl,
    runUrl: circuitNomadRunUrl,
  },
] as const;

export type HeroOption = (typeof heroOptions)[number];
export type HeroId = HeroOption['id'];

export const defaultHeroId: HeroId = 'shadow-operative';

export function heroOptionById(heroId: HeroId): HeroOption {
  return heroOptions.find((hero) => hero.id === heroId) ?? heroOptions[0];
}

export function isHeroId(value: unknown): value is HeroId {
  return heroOptions.some((hero) => hero.id === value);
}
