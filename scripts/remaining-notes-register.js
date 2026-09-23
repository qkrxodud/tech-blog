// 새로 옮긴 학습노트를 data/posts.json에 등록한다.
// 기존 연재 사이사이에 끼워 넣는 글이라, 기존 글의 편 번호부터 다시 매긴다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POSTS = path.join(ROOT, 'data', 'posts.json');
const posts = JSON.parse(fs.readFileSync(POSTS, 'utf8'));
const bySlug = Object.fromEntries(posts.map(p => [p.slug, p]));

// 기존 글의 새 편 번호. 강의 커리큘럼 순서를 따른다.
const RENUMBER = {
  // 스프링 핵심 원리 (8편 → 18편)
  'spring-core-example': 2,
  'spring-core-singleton': 9,
  'spring-core-component-scan': 10,
  'spring-core-constructor-injection': 11,
  'spring-core-bean-conflict': 12,
  'spring-core-bean-lifecycle': 15,
  'spring-core-prototype-scope': 16,
  'spring-core-web-scope': 18,
  // 스프링 입문 (6편 → 12편)
  'spring-intro-web-basics': 1,
  'spring-intro-member-backend-1': 2,
  'spring-intro-member-backend-2': 3,
  'spring-intro-member-web': 6,
  'spring-intro-jdbc': 8,
  'spring-intro-jpa-test': 10,
  // HTTP 웹 기본 지식 (3편 → 5편)
  'http-internet-network': 1,
  'http-basics': 3,
  'http-methods': 4,
  // 클린 코드 with Java (12편 → 16편)
  'ccj-01-stream-lambda-optional': 2,
  'ccj-02-learning-test': 3,
  'ccj-03-string-calculator': 5,
  'ccj-04-lotto-auto': 6,
  'ccj-05-lotto-second-prize': 7,
  'ccj-06-lotto-manual': 8,
  'ccj-07-ladder-create': 9,
  'ccj-08-ladder-run': 10,
  'ccj-09-ladder-refactor': 11,
  'ccj-10-racing-car': 12,
  'ccj-11-racing-winner': 13,
  'ccj-12-racing-refactor': 14,
  // 자바 ORM 표준 JPA (12편 → 13편) — 지연 로딩이 8편으로 들어온다
  'jpa-cascade': 9,
  'jpa-value-types': 10,
  'jpa-immutable-value-types': 11,
  'jpa-jpql-basics': 12,
  'jpa-jpql-advanced': 13,
};

let moved = 0;
for (const [slug, order] of Object.entries(RENUMBER)) {
  const p = bySlug[slug];
  if (!p) { console.error(`✗ 없는 글: ${slug}`); continue; }
  if (p.seriesOrder !== order) { p.seriesOrder = order; moved++; }
}

// 홀로 있던 카프카 글을 새 연재에 합류시킨다.
if (bySlug['kafka-ecosystem']) {
  bySlug['kafka-ecosystem'].series = '아파치 카프카 입문';
  bySlug['kafka-ecosystem'].seriesOrder = 2;
}

// 새 글 등록
const plan = JSON.parse(fs.readFileSync('/tmp/plan.json', 'utf8'));
let added = 0, skipped = 0;
for (const x of plan) {
  if (!fs.existsSync(path.join(ROOT, 'content', x.slug, 'index.md'))) {
    console.error(`✗ 본문 없음, 건너뜀: ${x.slug}`);
    skipped++;
    continue;
  }
  if (bySlug[x.slug]) { console.error(`· 이미 등록됨: ${x.slug}`); continue; }
  const entry = { slug: x.slug, category: x.category };
  if (x.series) { entry.series = x.series; entry.seriesOrder = x.seriesOrder; }
  if (x.date) entry.date = x.date;
  posts.push(entry);
  added++;
}

fs.writeFileSync(POSTS, JSON.stringify(posts, null, 2) + '\n');
console.log(`편 번호 조정 ${moved}편, 새로 등록 ${added}편${skipped ? `, 본문 없어 건너뜀 ${skipped}편` : ''}`);
console.log(`전체 ${posts.length}편`);

// 연재별 편 번호가 1..n으로 빠짐없이 이어지는지 확인한다.
const series = {};
for (const p of posts) if (p.series) (series[p.series] ??= []).push(p.seriesOrder);
for (const [name, orders] of Object.entries(series)) {
  const sorted = [...orders].sort((a, b) => a - b);
  const want = sorted.map((_, i) => i + 1);
  if (String(sorted) !== String(want)) console.error(`⚠ ${name}: 편 번호가 어긋납니다 — ${sorted.join(',')}`);
}
