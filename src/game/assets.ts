import type { LevelDefinition } from './types';

export function logoSvg(): string {
  return `
    <svg viewBox="0 0 360 116" role="img" aria-label="Shadow Circuit logo">
      <defs>
        <linearGradient id="logoMark" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#7dfcc6"/>
          <stop offset="1" stop-color="#5a8dff"/>
        </linearGradient>
        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#7dfcc6" flood-opacity=".42"/>
        </filter>
      </defs>
      <path d="M63 14 L113 43 V73 L63 102 L13 73 V43 Z" fill="#07111b" stroke="url(#logoMark)" stroke-width="4" filter="url(#logoGlow)"/>
      <path d="M49 44 V35 q0 -14 14 -14 q14 0 14 14 v9" fill="none" stroke="#7dfcc6" stroke-width="6" stroke-linecap="round"/>
      <rect x="35" y="43" width="56" height="42" rx="8" fill="#0d1724" stroke="#7dfcc6" stroke-width="4"/>
      <text x="63" y="72" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900" fill="#eff8ff">SC</text>
      <path d="M93 64 h30 m0 0 v-18 h21 m-51 28 h20 v16 h28" fill="none" stroke="#5a8dff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="146" cy="46" r="5" fill="#5a8dff"/>
      <circle cx="142" cy="90" r="5" fill="#7dfcc6"/>
      <text x="161" y="55" font-family="Inter, Arial, sans-serif" font-size="33" font-weight="900" fill="#eff8ff">SHADOW</text>
      <text x="162" y="90" font-family="Inter, Arial, sans-serif" font-size="33" font-weight="900" fill="#7dfcc6">CIRCUIT</text>
      <path d="M164 99 h126" stroke="#5a8dff" stroke-width="3" stroke-linecap="round"/>
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
    .map((light) => `<circle cx="${toX(light.position.x).toFixed(1)}" cy="${toY(light.position.z).toFixed(1)}" r="10" fill="#9fb2c2" opacity=".1"/>`)
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
