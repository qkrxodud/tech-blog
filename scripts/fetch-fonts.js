// 웹폰트 선언을 내려받아 assets/fonts.css로 저장한다.
//
// 구글 폰트를 화면에서 바로 부르면 글자가 뜨기 전에 CSS 한 장을 기다려야 한다.
// 한글 폰트는 글자를 백여 조각으로 쪼개 놓아 이 CSS가 유난히 크다(3종 10굵기일
// 때 압축하고도 146KB였다). 글꼴 파일 자체는 조각마다 필요한 것만 받으므로
// 그대로 두고, 선언만 우리 쪽으로 가져와 함께 실어 보낸다.
//
// 폰트 종류나 굵기를 바꿀 때만 다시 돌리면 된다. 평소 빌드는 이 파일을 그냥 쓴다.
//   node scripts/fetch-fonts.js
const fs = require('fs');
const path = require('path');

// 화면에서 실제로 쓰는 것만 적는다. 굵기 하나가 한글 폰트 기준 13KB쯤 된다.
//   IBM Plex Sans KR 400/600/700 — 본문, 탭·태그, 제목
//   JetBrains Mono  400/700      — 터미널 창, 코드
// 본문 글꼴 목록의 Noto Sans KR은 내려받지 않는다. 맨 앞의 IBM Plex Sans KR이
// 한글을 모두 갖고 있어 차례가 오지 않는다. 혹시 빠진 글자가 있으면 기기에 깔린
// 글꼴이 대신 그리므로 네모로 나오지는 않는다.
const FAMILIES = [
  'IBM+Plex+Sans+KR:wght@400;600;700',
  'JetBrains+Mono:wght@400;700',
];

// woff2를 받으려면 요즘 브라우저인 척해야 한다. 옛 브라우저로 보이면 용량이
// 몇 배인 ttf 주소를 내려준다.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const url = `https://fonts.googleapis.com/css2?${FAMILIES.map(f => `family=${f}`).join('&')}&display=swap`;

(async () => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`폰트 선언을 받지 못했습니다 (${res.status})`);
  const css = await res.text();

  const faces = (css.match(/@font-face/g) || []).length;
  if (faces < 10) throw new Error(`받아 온 선언이 너무 적습니다 (${faces}개). 주소를 확인하세요.`);
  if (!css.includes('.woff2')) throw new Error('woff2가 아닌 형식을 받았습니다.');

  const head = `/* 이 파일은 scripts/fetch-fonts.js가 만듭니다. 직접 고치지 마세요.\n`
    + `   ${FAMILIES.join(' / ').replace(/\+/g, ' ')}\n`
    + `   글꼴 파일은 fonts.gstatic.com에서 필요한 조각만 받아 갑니다. */\n`;

  const out = path.join(__dirname, '..', 'assets', 'fonts.css');
  fs.writeFileSync(out, head + css);
  console.log(`assets/fonts.css — 선언 ${faces}개, ${(Buffer.byteLength(css) / 1024).toFixed(0)}KB`);
})();
