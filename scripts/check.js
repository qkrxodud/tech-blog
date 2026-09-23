// 빌드 결과를 점검한다. 링크 깨짐, 이미지 누락, frontmatter 누락, 문체 이탈을 찾는다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'content');
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'categories.json'), 'utf8'));

const problems = [];
const warn = (kind, slug, msg) => problems.push({ kind, slug, msg });

// 1) 콘텐츠 존재와 frontmatter
const slugs = new Set();
for (const p of posts) {
  if (slugs.has(p.slug)) warn('중복 slug', p.slug, '같은 slug가 두 번 등록됨');
  slugs.add(p.slug);
  if (!config.categories[p.category]) warn('알 수 없는 카테고리', p.slug, p.category);
  const f = path.join(CONTENT, p.slug, 'index.md');
  if (!fs.existsSync(f)) { warn('본문 없음', p.slug, 'content/<slug>/index.md 없음'); continue; }
  const raw = fs.readFileSync(f, 'utf8');
  if (!raw.startsWith('---')) { warn('frontmatter 없음', p.slug, ''); continue; }
  for (const key of ['title', 'tags', 'summary']) {
    if (!new RegExp(`^${key}:`, 'm').test(raw)) warn('frontmatter 항목 누락', p.slug, key);
  }
  const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '');
  if (body.trim().length < 200) warn('본문이 매우 짧음', p.slug, `${body.trim().length}자`);
  // 코드블록·인용을 뺀 서술문에서 반말 종결을 찾는다.
  const prose = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*[-*|>#].*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const casual = prose.match(/(?:[가-힣)\]])(?:했다|한다|이다|있다|없다|된다|같다|보자|하자|였다|아니다|싶다)\.（?/g);
  if (casual && casual.length > 2) warn('반말 종결 의심', p.slug, `${casual.length}건 (예: ${casual.slice(0, 3).join(', ')})`);
  // 노션 속성 줄이 본문에 남아 있으면 글 맨 앞에 메타데이터가 노출된다.
  const head = body.trim().split('\n').slice(0, 8).join('\n');
  const leftover = head.match(/^(상태|담당자|속성|속성 1|만든날짜|수정날짜|날짜|순서|태그):/m);
  if (leftover) warn('노션 속성 잔존', p.slug, leftover[0]);
}

// 2) 강의 노트에 슬라이드 캡처가 딸려 오지 않았는지
//    (유료 강의 자료라 본문에 실을 수 없다 — scripts/LECTURE_RULES.md 참고)
const LECTURE_SERIES = new Set([
  '스프링 입문', '스프링 핵심 원리', '스프링 MVC', '자바 ORM 표준 JPA',
  '스프링 데이터 JPA', 'Querydsl', '스프링 부트와 JPA 활용',
  '클린 코드 with Java', 'HTTP 웹 기본 지식',
]);
const LECTURE_CATS = new Set(['algorithm', 'infra', 'clean-code-java', 'network']);
for (const p of posts) {
  if (!LECTURE_SERIES.has(p.series) && !LECTURE_CATS.has(p.category)) continue;
  const md = path.join(CONTENT, p.slug, 'index.md');
  if (fs.existsSync(md) && /!\[[^\]]*\]\(/.test(fs.readFileSync(md, 'utf8'))) {
    warn('강의 노트에 이미지', p.slug, '슬라이드 캡처로 보이는 이미지가 본문에 있음');
  }
  if (fs.existsSync(path.join(CONTENT, p.slug, 'images'))) {
    warn('강의 노트에 images 폴더', p.slug, '');
  }
}

// 3) 시리즈 순서 충돌
const series = {};
for (const p of posts) if (p.series) (series[p.series] ??= []).push(p);
for (const [name, list] of Object.entries(series)) {
  const seen = new Map();
  for (const p of list) {
    if (typeof p.seriesOrder !== 'number') warn('시리즈 순서 없음', p.slug, name);
    else if (seen.has(p.seriesOrder)) warn('시리즈 순서 충돌', p.slug, `${name} #${p.seriesOrder} — ${seen.get(p.seriesOrder)}와 중복`);
    else seen.set(p.seriesOrder, p.slug);
  }
}

// 3) 빌드 산출물의 내부 링크와 이미지
if (fs.existsSync(DIST)) {
  const htmls = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.html')) htmls.push(full);
    }
  })(DIST);

  for (const file of htmls) {
    const html = fs.readFileSync(file, 'utf8');
    const dir = path.dirname(file);
    const rel = path.relative(DIST, file);
    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
    for (const ref of refs) {
      if (/^(https?:|data:|mailto:|#)/.test(ref)) continue;
      // 404 페이지는 배포 도메인 기준 절대경로를 쓴다. 로컬 dist에는 그 경로가 없다.
      if (ref.startsWith('/')) continue;
      // 정적 파일 주소에는 캐시 무효화용 ?v=… 가 붙는다. 파일을 찾을 때는 뗀다.
      const clean = ref.split(/[?#]/)[0];
      if (!clean) continue;
      const target = path.resolve(dir, decodeURIComponent(clean));
      const ok = fs.existsSync(target) || fs.existsSync(path.join(target, 'index.html'));
      if (!ok) warn('링크 깨짐', rel, ref);
    }
    // 코드 예제 안의 주석은 글의 일부다. 산문에 남은 편집 메모만 찾는다.
    const visible = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<pre[\s\S]*?<\/pre>/g, '');
    if (/이미지\s*누락|누락\s*이미지|원본 내보내기에 미포함/.test(visible)) {
      warn('편집 흔적 노출', rel, '편집 메모가 화면에 보임');
    }
  }

  // 본문에 삽입되지 않은 이미지
  for (const p of posts) {
    const imgDir = path.join(CONTENT, p.slug, 'images');
    if (!fs.existsSync(imgDir)) continue;
    const md = path.join(CONTENT, p.slug, 'index.md');
    if (!fs.existsSync(md)) continue;
    const body = fs.readFileSync(md, 'utf8');
    for (const f of fs.readdirSync(imgDir)) {
      if (f.startsWith('.')) continue;
      const num = (f.match(/^(\d+)_/) || [])[1];
      const referenced = body.includes(f) || (num && new RegExp(`images/${num}[^\\s)]*`).test(body));
      if (!referenced) warn('본문에 안 쓰인 이미지', p.slug, f);
    }
  }
}

// 결과
const byKind = {};
for (const p of problems) (byKind[p.kind] ??= []).push(p);
if (!problems.length) {
  console.log('점검 완료: 문제 없음');
} else {
  for (const [kind, list] of Object.entries(byKind)) {
    console.log(`\n[${kind}] ${list.length}건`);
    for (const p of list.slice(0, 12)) console.log(`  - ${p.slug}${p.msg ? ': ' + p.msg : ''}`);
    if (list.length > 12) console.log(`  … 외 ${list.length - 12}건`);
  }
  console.log(`\n합계 ${problems.length}건`);
}
