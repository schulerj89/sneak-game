import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

type ReferencePlate = Readonly<{
  filePath: string;
  svg: string;
}>;

const plates: readonly ReferencePlate[] = [
  {
    filePath: 'src/assets/objectives/reference/ultra-keycard-reference.png',
    svg: keycardSvg(),
  },
  {
    filePath: 'src/assets/objectives/reference/ultra-terminal-reference.png',
    svg: terminalSvg(),
  },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });

  for (const plate of plates) {
    await mkdir(dirname(plate.filePath), { recursive: true });
    await page.setContent(`
      <html>
        <body>
          <style>
            html, body { width: 1024px; height: 1024px; margin: 0; background: transparent; }
            svg { display: block; width: 1024px; height: 1024px; }
          </style>
          ${plate.svg}
        </body>
      </html>
    `);
    await page.screenshot({ path: plate.filePath, omitBackground: true });
    console.info(`[reference] wrote ${plate.filePath}`);
  }
} finally {
  await browser.close();
}

function keycardSvg(): string {
  return `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardBody" x1="110" y1="275" x2="895" y2="700" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#26282d"/>
      <stop offset="0.48" stop-color="#15171d"/>
      <stop offset="1" stop-color="#34363d"/>
    </linearGradient>
    <linearGradient id="cardEdge" x1="160" y1="250" x2="840" y2="740" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffdc62"/>
      <stop offset="0.38" stop-color="#3c3220"/>
      <stop offset="1" stop-color="#ffb82e"/>
    </linearGradient>
    <linearGradient id="chip" x1="315" y1="430" x2="470" y2="545" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f4d78a"/>
      <stop offset="0.5" stop-color="#94723a"/>
      <stop offset="1" stop-color="#fff0b0"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000" flood-opacity="0.32"/>
    </filter>
    <filter id="yellowGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g transform="translate(68 124) rotate(-10 444 388)" filter="url(#softShadow)">
    <path d="M160 192h610c42 0 76 34 76 76v330c0 42-34 76-76 76H160c-42 0-76-34-76-76V268c0-42 34-76 76-76Z" fill="url(#cardEdge)"/>
    <path d="M178 224h574c34 0 62 28 62 62v292c0 34-28 62-62 62H178c-34 0-62-28-62-62V286c0-34 28-62 62-62Z" fill="url(#cardBody)" stroke="#5d6270" stroke-width="8"/>

    <path d="M156 306h616" stroke="#4b505d" stroke-width="7" opacity="0.74"/>
    <path d="M156 576h616" stroke="#090b0f" stroke-width="8" opacity="0.8"/>
    <path d="M615 260h112c24 0 44 20 44 44v72" fill="none" stroke="#ffcc43" stroke-width="12" stroke-linecap="round" filter="url(#yellowGlow)"/>
    <path d="M640 606H270c-22 0-40-18-40-40v-42" fill="none" stroke="#ffcc43" stroke-width="10" stroke-linecap="round" filter="url(#yellowGlow)"/>

    <rect x="278" y="398" width="190" height="134" rx="20" fill="url(#chip)" stroke="#3d2e17" stroke-width="7"/>
    <path d="M302 433h142M302 467h142M344 410v108M398 410v108" stroke="#493719" stroke-width="8" stroke-linecap="round"/>
    <rect x="532" y="392" width="224" height="42" rx="21" fill="#0b0d13" stroke="#6f7480" stroke-width="5"/>
    <rect x="532" y="466" width="158" height="35" rx="17" fill="#1c2029" stroke="#565d6c" stroke-width="5"/>
    <rect x="710" y="466" width="46" height="35" rx="12" fill="#ffc640" filter="url(#yellowGlow)"/>

    <circle cx="188" cy="282" r="14" fill="#111318" stroke="#727782" stroke-width="5"/>
    <circle cx="748" cy="282" r="14" fill="#111318" stroke="#727782" stroke-width="5"/>
    <circle cx="188" cy="588" r="14" fill="#111318" stroke="#727782" stroke-width="5"/>
    <circle cx="748" cy="588" r="14" fill="#111318" stroke="#727782" stroke-width="5"/>

    <path d="M180 356h70v-44h94" fill="none" stroke="#d9a921" stroke-width="7" stroke-linecap="round"/>
    <path d="M494 552h94v-68h112" fill="none" stroke="#d9a921" stroke-width="7" stroke-linecap="round"/>
    <path d="M180 516h78v-46" fill="none" stroke="#87909f" stroke-width="5" stroke-linecap="round"/>
    <path d="M572 348h52v-38" fill="none" stroke="#87909f" stroke-width="5" stroke-linecap="round"/>
    <circle cx="252" cy="312" r="10" fill="#ffcf4d" filter="url(#yellowGlow)"/>
    <circle cx="700" cy="484" r="10" fill="#ffcf4d" filter="url(#yellowGlow)"/>
    <circle cx="258" cy="470" r="8" fill="#aeb7c8"/>
    <circle cx="624" cy="310" r="8" fill="#aeb7c8"/>

    <path d="M164 246c18-14 46-20 86-20h484" stroke="#ffffff" stroke-width="10" opacity="0.14" stroke-linecap="round"/>
    <path d="M222 626h502c34 0 60-23 72-51" stroke="#000000" stroke-width="14" opacity="0.22" stroke-linecap="round"/>
  </g>
</svg>`;
}

function terminalSvg(): string {
  return `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="case" x1="180" y1="270" x2="820" y2="760" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#303845"/>
      <stop offset="0.44" stop-color="#171b23"/>
      <stop offset="1" stop-color="#3d4654"/>
    </linearGradient>
    <linearGradient id="screen" x1="285" y1="292" x2="735" y2="565" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8dffff"/>
      <stop offset="0.42" stop-color="#16bdda"/>
      <stop offset="1" stop-color="#063d59"/>
    </linearGradient>
    <filter id="cyanGlow" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="terminalShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <g transform="translate(86 122) rotate(8 426 390)" filter="url(#terminalShadow)">
    <path d="M190 232h522l108 102v288c0 45-36 81-81 81H168c-45 0-81-36-81-81V335l103-103Z" fill="#07090d"/>
    <path d="M208 260h486l88 82v260c0 36-29 65-65 65H190c-36 0-65-29-65-65V342l83-82Z" fill="url(#case)" stroke="#6e7785" stroke-width="8"/>

    <path d="M245 302h400c27 0 49 22 49 49v152c0 27-22 49-49 49H245c-27 0-49-22-49-49V351c0-27 22-49 49-49Z" fill="#071018" stroke="#0ad9ff" stroke-width="8" filter="url(#cyanGlow)"/>
    <path d="M264 324h362c20 0 36 16 36 36v126c0 20-16 36-36 36H264c-20 0-36-16-36-36V360c0-20 16-36 36-36Z" fill="url(#screen)"/>
    <path d="M262 362h338M262 412h286M262 464h214" stroke="#d9ffff" stroke-width="8" stroke-linecap="round" opacity="0.48"/>
    <path d="M619 345l29 31-29 31" fill="none" stroke="#e8ffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>

    <rect x="208" y="594" width="80" height="46" rx="12" fill="#151b25" stroke="#798494" stroke-width="5"/>
    <rect x="308" y="594" width="80" height="46" rx="12" fill="#151b25" stroke="#798494" stroke-width="5"/>
    <rect x="408" y="594" width="80" height="46" rx="12" fill="#151b25" stroke="#798494" stroke-width="5"/>
    <rect x="508" y="594" width="80" height="46" rx="12" fill="#073042" stroke="#1bdfff" stroke-width="5" filter="url(#cyanGlow)"/>
    <rect x="608" y="594" width="80" height="46" rx="12" fill="#151b25" stroke="#798494" stroke-width="5"/>

    <path d="M735 383h36v154h-36" fill="none" stroke="#1bdfff" stroke-width="9" stroke-linecap="round" filter="url(#cyanGlow)"/>
    <path d="M164 383h-36v154h36" fill="none" stroke="#1bdfff" stroke-width="9" stroke-linecap="round" filter="url(#cyanGlow)"/>
    <path d="M205 678h420" stroke="#0b0e15" stroke-width="14" stroke-linecap="round"/>
    <path d="M228 680h138M504 680h108" stroke="#8b95a4" stroke-width="6" stroke-linecap="round" opacity="0.62"/>

    <circle cx="186" cy="318" r="14" fill="#0c1018" stroke="#828b98" stroke-width="5"/>
    <circle cx="704" cy="318" r="14" fill="#0c1018" stroke="#828b98" stroke-width="5"/>
    <circle cx="186" cy="631" r="14" fill="#0c1018" stroke="#828b98" stroke-width="5"/>
    <circle cx="704" cy="631" r="14" fill="#0c1018" stroke="#828b98" stroke-width="5"/>

    <path d="M214 278c24-14 59-20 105-20h344" stroke="#ffffff" stroke-width="10" opacity="0.13" stroke-linecap="round"/>
    <path d="M154 356l58-66h472l66 64" stroke="#ffffff" stroke-width="6" opacity="0.08"/>
    <path d="M164 649h520c44 0 72-23 84-57" stroke="#000000" stroke-width="13" opacity="0.22" stroke-linecap="round"/>
  </g>
</svg>`;
}
