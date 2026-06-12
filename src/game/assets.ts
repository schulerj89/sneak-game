import type { LevelDefinition } from './types';

export function logoSvg(): string {
  return `
    <svg viewBox="0 0 360 116" role="img" aria-label="Shadow Circuit logo">
      <defs>
        <linearGradient id="logoBeam" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#7dfcc6"/>
          <stop offset="1" stop-color="#5a8dff"/>
        </linearGradient>
      </defs>
      <path d="M22 82 L102 28 L102 106 Z" fill="#7dfcc6" opacity=".18"/>
      <circle cx="77" cy="67" r="25" fill="#101722" stroke="#7dfcc6" stroke-width="4"/>
      <path d="M59 64 q18 -28 36 0 v17 q-18 17 -36 0 Z" fill="#05070b"/>
      <circle cx="68" cy="70" r="3.6" fill="#7dfcc6"/>
      <circle cx="86" cy="70" r="3.6" fill="#7dfcc6"/>
      <path d="M101 51 l58 -18 l-20 34 Z" fill="url(#logoBeam)" opacity=".5"/>
      <text x="143" y="58" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="#eff8ff">SHADOW</text>
      <text x="145" y="92" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="#7dfcc6">CIRCUIT</text>
      <path d="M145 101 h144" stroke="#5a8dff" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `;
}

export function levelThumbnailSvg(level: LevelDefinition, levelNumber: number): string {
  const width = 220;
  const height = 132;
  const xScale = width / level.floorSize.x;
  const zScale = height / level.floorSize.z;
  const toX = (x: number): number => (x + level.floorSize.x / 2) * xScale;
  const toY = (z: number): number => (z + level.floorSize.z / 2) * zScale;

  const obstacles = level.obstacles
    .map((obstacle) => {
      const x = toX(obstacle.center.x - obstacle.size.x / 2);
      const y = toY(obstacle.center.z - obstacle.size.z / 2);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(obstacle.size.x * xScale).toFixed(1)}" height="${(obstacle.size.z * zScale).toFixed(1)}" rx="2" fill="#314052"/>`;
    })
    .join('');

  const enemies = level.enemies
    .map((enemy) => `<circle cx="${toX(enemy.start.x).toFixed(1)}" cy="${toY(enemy.start.z).toFixed(1)}" r="4.5" fill="#ff5964"/>`)
    .join('');

  const lights = level.lights
    .map((light) => `<circle cx="${toX(light.position.x).toFixed(1)}" cy="${toY(light.position.z).toFixed(1)}" r="10" fill="${light.color}" opacity=".16"/>`)
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${level.name} preview">
      <rect width="${width}" height="${height}" fill="#070b12"/>
      ${lights}
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="#233244" stroke-width="2"/>
      ${obstacles}
      ${enemies}
      <circle cx="${toX(level.start.x).toFixed(1)}" cy="${toY(level.start.z).toFixed(1)}" r="5" fill="#7dfcc6"/>
      <circle cx="${toX(level.goal.x).toFixed(1)}" cy="${toY(level.goal.z).toFixed(1)}" r="6" fill="#8eff81"/>
      <text x="12" y="24" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#eff8ff">${levelNumber}</text>
    </svg>
  `;
}
