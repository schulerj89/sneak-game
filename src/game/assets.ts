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
