// 날짜를 못 찾은 글의 정렬 순서를 정한다.
//
// 노션 페이지 ID는 2024년 무렵부터 생성 순서대로 증가한다(앞 세 자리 기준).
// 날짜를 아는 글들로 확인해 보면 이 구간에서는 순서가 어긋나지 않는다. 그래서
// 날짜가 없는 최근 글은 ID로 앞뒤를 가늠하고, 화면에는 날짜를 띄우지 않는다.
// 추정한 시점을 작성일인 것처럼 보여 주지 않기 위해서다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXPORT = '/Users/taeyoung/Downloads/Export-c1198803-3981-4e38-9804-6e391f86aed6';
const nfc = s => s.normalize('NFC');
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));

// slug → 원본 md 경로
const srcOf = {};
for (const p of posts) {
  if (!p.dir) continue;
  const meta = path.join(EXPORT, '_tistory_ready', p.dir, 'meta.md');
  if (!fs.existsSync(meta)) continue;
  const m = fs.readFileSync(meta, 'utf8').match(/^\/Users\/[^\n]*\.md$/m);
  if (m) srcOf[p.slug] = m[0];
}
if (fs.existsSync('/tmp/lecture-map.json')) {
  for (const x of JSON.parse(fs.readFileSync('/tmp/lecture-map.json', 'utf8'))) {
    if (!srcOf[x.slug]) srcOf[x.slug] = path.join(EXPORT, x.src);
  }
}
// 일괄 변환을 거치지 않고 직접 옮긴 글들
for (const [slug, rel] of Object.entries({
  'retrospective-2024': '코징의 개발탐방/[실무] 회고록/2024년 회고 e091cf9ffa834aa1add383c21113fae9.md',
  'retrospective-2025': '코징의 개발탐방/[실무] 회고록/2025년도 회고 2e6db2e0c45e80afb498d94919b4dfef.md',
  'gc-os-basics': '코징의 개발탐방/GC를 이해하기 위해 알아야 되는 OS 지식 2f1db2e0c45e80928fb8e122ebbd3a95.md',
  'jvm-execution-classloading': '코징의 개발탐방/GC를 이해하기 위해 알아야 되는 OS 지식 2f9db2e0c45e80fd8cadefc2b2bb353c.md',
  'gc-tuning-criteria': '코징의 개발탐방/GC를 이해하기 위해 알아야 되는 OS 지식 308db2e0c45e80ec8b97e675e6f30c4c.md',
})) if (!srcOf[slug]) srcOf[slug] = path.join(EXPORT, rel);

// 날짜를 아는 글로 "ID 앞자리 → 날짜" 기준점을 만든다.
const anchors = [];
for (const p of posts) {
  const s = srcOf[p.slug];
  if (!s || !p.date) continue;
  const id = (s.match(/([0-9a-f]{32})\.md$/) || [])[1];
  if (!id || !/db2e0c45e80/.test(id)) continue;
  anchors.push({ n: parseInt(id.slice(0, 3), 16), date: p.date });
}
anchors.sort((a, b) => a.n - b.n);

// 기준점 사이를 잇는 대략의 시점. 바깥 구간은 끝 기준점을 쓴다.
function guess(n) {
  if (!anchors.length) return null;
  if (n <= anchors[0].n) return anchors[0].date;
  if (n >= anchors[anchors.length - 1].n) return anchors[anchors.length - 1].date;
  for (let i = 1; i < anchors.length; i++) {
    if (n > anchors[i].n) continue;
    const a = anchors[i - 1], b = anchors[i];
    const ta = Date.parse(a.date), tb = Date.parse(b.date);
    const r = (n - a.n) / (b.n - a.n || 1);
    return new Date(ta + (tb - ta) * r).toISOString().slice(0, 10);
  }
  return null;
}

let guessed = 0, kept = 0, none = 0;
for (const p of posts) {
  delete p.order;
  if (p.date) { kept++; continue; }
  const s = srcOf[p.slug];
  const id = s ? (s.match(/([0-9a-f]{32})\.md$/) || [])[1] : null;
  if (id && /db2e0c45e80/.test(id)) {
    const n = parseInt(id.slice(0, 3), 16);
    const g = guess(n);
    // 기준점 바깥은 모두 같은 날짜로 뭉치므로, 페이지 번호를 덧붙여
    // 그 안에서도 순서가 서도록 한다(표시용이 아니라 정렬용이다).
    if (g) { p.order = `${g}#${String(n).padStart(5, '0')}`; guessed++; continue; }
  }
  none++;
}

// 한 연재에서 몇 편만 날짜를 알면, 나머지도 같은 무렵에 쓴 글이다.
// 연재가 흩어지지 않도록 그 연재에서 가장 이른 시점을 빌려 준다.
const seriesWhen = {};
for (const p of posts) {
  const when = p.date || p.order;
  if (!p.series || !when) continue;
  if (!seriesWhen[p.series] || when < seriesWhen[p.series]) seriesWhen[p.series] = when;
}
let borrowed = 0;
for (const p of posts) {
  if (p.date || p.order || !p.series) continue;
  if (seriesWhen[p.series]) { p.order = seriesWhen[p.series]; borrowed++; none--; }
}

const body = posts.map(p => '  ' + JSON.stringify(p)).join(',\n');
fs.writeFileSync(path.join(ROOT, 'data', 'posts.json'), '[\n' + body + '\n]\n');
console.log(`기준점 ${anchors.length}개 | 날짜 있음 ${kept} | 순서만 추정 ${guessed} | 연재에서 빌림 ${borrowed} | 단서 없음 ${none}`);
