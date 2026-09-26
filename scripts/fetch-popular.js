// 최근에 많이 읽힌 글을 GoatCounter에서 받아 data/popular.json에 적는다.
//
// 배포할 때 한 번 돌린다(.github/workflows/deploy.yml). 토큰이 없거나 집계
// 서버가 대답하지 않으면 아무것도 고치지 않고 조용히 끝난다. 그러면 직전에
// 적어 둔 목록이 그대로 쓰이고, 그것도 비어 있으면 화면에 이 칸이 아예 없다.
// 통계 때문에 배포가 멈추는 일은 없어야 한다.
//
//   GOATCOUNTER_TOKEN=... node scripts/fetch-popular.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'popular.json');
const DAYS = 30;     // 최근 한 달. 더 길게 잡으면 옛 글이 계속 자리를 지킨다.
const KEEP = 6;      // 화면에 보여 줄 편수

const done = msg => { console.log(`많이 읽힌 글: ${msg}`); process.exit(0); };

(async () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'categories.json'), 'utf8'));
  const site = (config.analytics || {}).goatcounter;
  const token = process.env.GOATCOUNTER_TOKEN;
  if (!site) done('집계를 쓰지 않아 건너뜁니다');
  if (!token) done('GOATCOUNTER_TOKEN이 없어 건너뜁니다');

  const hour = d => new Date(Math.floor(d / 3600000) * 3600000).toISOString().replace(/\.\d+Z$/, 'Z');
  const now = Date.now();
  const url = `https://${site}.goatcounter.com/api/v0/stats/hits`
    + `?start=${hour(now - DAYS * 86400000)}&end=${hour(now)}&limit=100`;

  let body;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) done(`집계 서버가 ${res.status}로 답해 건너뜁니다`);
    body = await res.json();
  } catch (e) {
    done(`집계 서버에 닿지 못해 건너뜁니다 (${e.message})`);
  }

  // 글 주소만 남긴다. 목록·태그·연재 페이지는 빼고, 아는 slug인지도 확인한다.
  const known = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8')).map(p => p.slug));
  const seen = new Map();
  for (const h of body.hits || []) {
    const m = String(h.path || '').match(/\/posts\/([^/?#]+)\/?$/);
    if (!m || !known.has(m[1])) continue;
    seen.set(m[1], (seen.get(m[1]) || 0) + (h.count || 0));   // 같은 글의 여러 주소를 합친다
  }

  const ranked = [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, KEEP)
    .map(([slug, count]) => ({ slug, count }));

  if (!ranked.length) done('아직 쌓인 기록이 없습니다');

  fs.writeFileSync(OUT, JSON.stringify({
    days: DAYS,
    updated: new Date().toISOString().slice(0, 10),
    posts: ranked,
  }, null, 2) + '\n');
  console.log(`많이 읽힌 글 ${ranked.length}편: ${ranked.map(r => r.slug).join(', ')}`);
})();
