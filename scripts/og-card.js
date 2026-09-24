// 글을 링크로 공유했을 때 보이는 카드 이미지를 만든다.
// 블로그 화면과 같은 터미널 창 모양으로 그려, 어디에 붙여도 같은 인상을 준다.
const sharp = require('sharp');

const W = 1200, H = 630;
const INK = '#111813', LINE = '#e8ebe9', FAINT = '#9aa39c';
const MUTED = '#5c655e', ACCENT = '#2f7d55', BG = '#fdfdfc';

// 카드는 빌드하는 컴퓨터에 깔린 폰트로 그려진다. 한글 폰트가 없으면 글자가
// 네모(두부)로 나오므로, 리눅스(배포용 러너)에 흔한 Noto CJK까지 적어 둔다.
const SANS = `'IBM Plex Sans KR','Noto Sans KR','Noto Sans CJK KR',sans-serif`;
const MONO = `'JetBrains Mono','Noto Sans Mono CJK KR',monospace`;

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
  <text x="600" y="70" font-family="${MONO}" font-size="19" fill="#7d8680" text-anchor="middle">~/tech-blog — zsh</text>

  <text x="100" y="168" font-family="${MONO}" font-size="23" fill="${ACCENT}">$ cat <tspan fill="${FAINT}">${esc(kind)}</tspan></text>

  <text font-family="${SANS}" font-size="${size}" font-weight="800" fill="${INK}">${titleTspans}</text>

  <path d="M100 486 H1100" stroke="${LINE}" stroke-width="2"/>
  <text x="100" y="528" font-family="${MONO}" font-size="24" fill="${MUTED}">${esc(meta)}</text>
  <text x="1100" y="528" font-family="${SANS}" font-size="25" font-weight="800" fill="${INK}" text-anchor="end">${esc(site)}<tspan fill="${ACCENT}">.</tspan></text>
</svg>`;
}

// 한글이 실제로 그려지는지 한 번만 확인한다. 없는 글자는 모두 같은 네모로
// 그려지므로, '한'과 세상에 없는 글자를 나란히 그려 보고 같으면 폰트가 없는 것이다.
let fontChecked = false;
async function assertKoreanFont() {
  if (fontChecked) return;
  const draw = ch => sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><text x="8" y="60" font-family="${SANS}" font-size="56">${ch}</text></svg>`,
  )).raw().toBuffer();
  const [korean, missing] = await Promise.all([draw('한'), draw('&#x10FFFF;')]);
  if (korean.equals(missing)) {
    throw new Error(
      '한글 폰트가 없어 카드 이미지의 글자가 네모로 나옵니다.\n' +
      '  리눅스: sudo apt-get install -y fonts-noto-cjk\n' +
      '  맥: Noto Sans KR 또는 IBM Plex Sans KR 설치',
    );
  }
  fontChecked = true;
}

async function renderCard(opts, outPath) {
  await assertKoreanFont();
  await sharp(Buffer.from(cardSvg(opts)))
    .png({ compressionLevel: 9, palette: true })
    .toFile(outPath);
}

module.exports = { renderCard };
