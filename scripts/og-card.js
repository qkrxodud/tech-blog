// 글을 링크로 공유했을 때 보이는 카드 이미지를 만든다.
// 블로그 화면과 같은 터미널 창 모양으로 그려, 어디에 붙여도 같은 인상을 준다.
const sharp = require('sharp');

const W = 1200, H = 630;
const INK = '#111813', LINE = '#e8ebe9', FAINT = '#9aa39c';
const MUTED = '#5c655e', ACCENT = '#2f7d55', BG = '#fdfdfc';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// 글자폭을 어림해 줄을 나눈다. 한글은 넓고 영문·숫자는 좁다.
function wrap(text, maxWidth, size) {
  const width = ch => (/[가-힣ㄱ-ㅎ]/.test(ch) ? size : /[A-Z]/.test(ch) ? size * 0.62 : /[a-z0-9]/.test(ch) ? size * 0.52 : size * 0.4);
  const lines = [];
  let line = '', w = 0;
  for (const word of String(text).split(/(\s+)/)) {
    const ww = [...word].reduce((a, c) => a + width(c), 0);
    if (w + ww > maxWidth && line.trim()) { lines.push(line.trim()); line = word.trimStart(); w = ww; }
    else { line += word; w += ww; }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function cardSvg({ title, kind, meta, site }) {
  const size = title.length > 40 ? 50 : title.length > 24 ? 58 : 66;
  const lines = wrap(title, 980, size).slice(0, 3);
  const startY = 300 - ((lines.length - 1) * (size * 1.32)) / 2;
  const titleTspans = lines
    .map((l, i) => `<tspan x="100" y="${(startY + i * size * 1.32).toFixed(0)}">${esc(l)}</tspan>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0H0V32" fill="none" stroke="#f1f3f2" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>

  <rect x="40" y="36" width="1120" height="558" rx="16" fill="#ffffff" stroke="${INK}" stroke-width="2"/>
  <path d="M40 92 H1160" stroke="${INK}" stroke-width="2"/>
  <rect x="40" y="38" width="1120" height="54" rx="16" fill="#f4f6f5"/>
  <path d="M40 92 H1160" stroke="${INK}" stroke-width="2"/>
  <circle cx="76" cy="64" r="8" fill="#eb5f57"/>
  <circle cx="102" cy="64" r="8" fill="#f5bd4e"/>
  <circle cx="128" cy="64" r="8" fill="#57c353"/>
  <text x="600" y="70" font-family="monospace" font-size="19" fill="#7d8680" text-anchor="middle">~/tech-blog — zsh</text>

  <text x="100" y="168" font-family="monospace" font-size="23" fill="${ACCENT}">$ cat <tspan fill="${FAINT}">${esc(kind)}</tspan></text>

  <text font-family="'IBM Plex Sans KR','Noto Sans KR',sans-serif" font-size="${size}" font-weight="800" fill="${INK}">${titleTspans}</text>

  <path d="M100 486 H1100" stroke="${LINE}" stroke-width="2"/>
  <text x="100" y="528" font-family="monospace" font-size="24" fill="${MUTED}">${esc(meta)}</text>
  <text x="1100" y="528" font-family="'IBM Plex Sans KR',sans-serif" font-size="25" font-weight="800" fill="${INK}" text-anchor="end">${esc(site)}<tspan fill="${ACCENT}">.</tspan></text>
</svg>`;
}

async function renderCard(opts, outPath) {
  await sharp(Buffer.from(cardSvg(opts)))
    .png({ compressionLevel: 9, palette: true })
    .toFile(outPath);
}

module.exports = { renderCard };
