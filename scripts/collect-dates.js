// 노션 내보내기에서 글 작성일을 모아 data/posts.json의 date 필드를 채운다.
//
// 날짜가 흩어져 있다. 어떤 글은 본문 맨 위 속성 줄에, 어떤 글은 상위 폴더의
// 데이터베이스 CSV에 들어 있고, 형식도 "2022년 5월 11일 오후 5:23"과
// "08/30/2026"이 섞여 있다. 둘 다 읽어 이른 쪽을 작성일로 본다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXPORT = '/Users/taeyoung/blog/Export-c1198803-3981-4e38-9804-6e391f86aed6';
const nfc = s => s.normalize('NFC');

// ---------- 날짜 파싱 ----------
function parseDate(raw) {
  if (!raw) return null;
  const s = nfc(String(raw)).trim();
  let m = s.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);          // 08/30/2026
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
const earlier = (a, b) => (!a ? b : !b ? a : (a < b ? a : b));

// ---------- 1) 원본 md의 속성 줄 ----------
// "수정날짜"는 나중에 손댄 시각이라 작성일로 보지 않는다.
const DATE_KEYS = /^(날짜|만든날짜|생성일|시작일)\s*:\s*(.+)$/;
function dateFromMd(file) {
  if (!fs.existsSync(file)) return null;
  const head = fs.readFileSync(file, 'utf8').split('\n').slice(0, 12);
  let best = null;
  for (const line of head) {
    const m = nfc(line).match(DATE_KEYS);
    if (m) best = earlier(best, parseDate(m[2]));
  }
  return best;
}

// ---------- 2) 데이터베이스 CSV ----------
function splitCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === ',' && !q) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// 제목(정규화) → 날짜
const byTitle = new Map();
(function scanCsv(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { scanCsv(full); continue; }
    if (!e.name.endsWith('.csv')) continue;
    const lines = fs.readFileSync(full, 'utf8').replace(/^﻿/, '').split('\n').filter(Boolean);
    if (lines.length < 2) continue;
    const head = splitCsvLine(lines[0]).map(h => nfc(h).trim());
    // 데이터베이스마다 제목·날짜 컬럼 이름이 제각각이다.
    const nameIdx = head.findIndex(h => /^(이름|제목|강의명)$/.test(h));
    if (nameIdx < 0) continue;
    const dateIdx = head.map((h, i) => (/^(날짜|만든날짜|생성일|시작일|작성일시|완료일)$/.test(h) ? i : -1)).filter(i => i >= 0);
    if (!dateIdx.length) continue;
    for (const line of lines.slice(1)) {
      const cols = splitCsvLine(line);
      const title = nfc((cols[nameIdx] || '').trim());
      if (!title) continue;
      let d = null;
      for (const i of dateIdx) d = earlier(d, parseDate(cols[i]));
      if (d) byTitle.set(title, earlier(byTitle.get(title), d));
    }
  }
})(EXPORT);

// ---------- slug → 원본 md 경로 ----------
const srcOf = {};
// (a) _tistory_ready 86편 — meta.md에 원본 경로가 적혀 있다
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));
for (const p of posts) {
  if (!p.dir) continue;
  const meta = path.join(EXPORT, '_tistory_ready', p.dir, 'meta.md');
  if (!fs.existsSync(meta)) continue;
  const m = fs.readFileSync(meta, 'utf8').match(/^\/Users\/[^\n]*\.md$/m);
  if (m) srcOf[p.slug] = m[0].replace('/Users/taeyoung/Downloads/Export-c1198803-3981-4e38-9804-6e391f86aed6', EXPORT);
}
// (b) 강의 노트 74편 — 변환할 때 쓴 매핑이 남아 있다
const lecMap = '/tmp/lecture-map.json';
if (fs.existsSync(lecMap)) {
  for (const x of JSON.parse(fs.readFileSync(lecMap, 'utf8'))) {
    if (!srcOf[x.slug]) srcOf[x.slug] = path.join(EXPORT, x.src);
  }
}
// (c) 나머지는 직접 지정
const EXTRA = {
  'retrospective-2024': '코징의 개발탐방/[실무] 회고록/2024년 회고 e091cf9ffa834aa1add383c21113fae9.md',
  'retrospective-2025': '코징의 개발탐방/[실무] 회고록/2025년도 회고 2e6db2e0c45e80afb498d94919b4dfef.md',
  'gc-os-basics': '코징의 개발탐방/GC를 이해하기 위해 알아야 되는 OS 지식 2f1db2e0c45e80928fb8e122ebbd3a95.md',
  'jvm-execution-classloading': '코징의 개발탐방/GC를 이해하기 위해 알아야 되는 OS 지식 2f9db2e0c45e80fd8cadefc2b2bb353c.md',
  'gc-tuning-criteria': '코징의 개발탐방/GC를 이해하기 위해 알아야 되는 OS 지식 308db2e0c45e80ec8b97e675e6f30c4c.md',
};
for (const [slug, rel] of Object.entries(EXTRA)) if (!srcOf[slug]) srcOf[slug] = path.join(EXPORT, rel);

// ---------- 수집 ----------
let filled = 0, missing = [];
for (const p of posts) {
  if (p.date) { filled++; continue; }           // 이미 정해 둔 날짜는 건드리지 않는다
  const src = srcOf[p.slug];
  let d = src ? dateFromMd(src) : null;
  if (!d && src) {
    // 파일명에서 제목을 떼어 CSV 쪽과 맞춰 본다
    const title = nfc(path.basename(src, '.md')).replace(/\s+[0-9a-f]{32}$/, '').trim();
    d = byTitle.get(title) || null;
  }
  if (d) { p.date = d; filled++; } else missing.push(p.slug);
}

const body = posts.map(p => '  ' + JSON.stringify(p)).join(',\n');
fs.writeFileSync(path.join(ROOT, 'data', 'posts.json'), '[\n' + body + '\n]\n');

console.log(`날짜 확보: ${filled}/${posts.length}`);
if (missing.length) {
  console.log(`\n못 찾은 글 ${missing.length}편:`);
  console.log('  ' + missing.slice(0, 40).join(', ') + (missing.length > 40 ? ' …' : ''));
}
