// 글마다 손으로 단 태그라 같은 말이 여러 표기로 갈렸다("Java"와 "자바",
// "클린코드"와 "클린 코드"). 태그로 글을 모아 보려면 먼저 표기를 하나로 맞춰야 한다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));

// 대표 표기로 모을 것들. 왼쪽이 대표, 오른쪽이 같은 뜻으로 볼 표기들.
const MERGE = {
  'Java': ['자바', 'JAVA', 'java'],
  'Spring': ['스프링'],
  'Spring Boot': ['SpringBoot', '스프링부트', '스프링 부트'],
  'JPA': ['jpa'],
  'Spring Data JPA': ['스프링 데이터 JPA', '스프링데이터JPA'],
  'Claude Code': ['ClaudeCode'],
  'Ralph Loop': ['RalphLoop'],
  'AI 협업': ['AI협업', 'AI 코딩', 'AI코딩'],
  'G1 GC': ['G1GC'],
  'GC': ['가비지 컬렉션', '가비지컬렉션', 'Garbage Collection'],
  '의존성 역전': ['의존성역전', 'DIP'],
  '슬로우 쿼리': ['슬로우쿼리'],
  '비관적 락': ['비관적락'],
  '낙관적 락': ['낙관적락'],
  '분산락': ['분산 락'],
  'B-Tree': ['BTree', 'B-tree', 'B tree'],
  '응용 서비스': ['응용서비스'],
  '클린 아키텍처': ['클린아키텍처'],
  '육각형 아키텍처': ['육각형아키텍처', '헥사고날 아키텍처', '헥사고날아키텍처'],
  '클린 코드': ['클린코드', 'Clean Code', 'CleanCode'],
  '일급 컬렉션': ['일급컬렉션'],
  '정적 팩토리 메서드': ['정적팩토리메서드', '정적 팩토리 메소드'],
  '테스트 코드': ['테스트코드'],
  '단위 테스트': ['단위테스트'],
  '영속성 컨텍스트': ['영속성컨텍스트'],
  '연관관계 매핑': ['연관관계매핑', '연관 관계 매핑'],
  '어노테이션': ['애노테이션', '애너테이션'],
  '네이밍 컨벤션': ['네이밍컨벤션'],
  '커밋 메시지': ['커밋메시지'],
  '커밋 컨벤션': ['커밋컨벤션'],
  '리팩터링': ['리팩토링'],
  'ElasticSearch': ['Elasticsearch', 'elasticsearch', 'ES'],
  '역인덱스': ['역색인'],
  'Querydsl': ['QueryDSL', 'querydsl'],
  'Kafka': ['카프카'],
  'MySQL': ['mysql'],
  'Redis': ['redis'],
  '동시성': ['동시성 제어', '동시성제어'],
  'DDD': ['도메인 주도 개발', '도메인주도개발'],
};

// 별칭 → 대표 표기
const canon = {};
for (const [main, aliases] of Object.entries(MERGE)) {
  canon[main.toLowerCase().replace(/[\s_-]/g, '')] = main;
  for (const a of aliases) canon[a.toLowerCase().replace(/[\s_-]/g, '')] = main;
}
const pick = t => canon[t.toLowerCase().replace(/[\s_-]/g, '')] || t;

let changed = 0, merged = 0;
for (const p of posts) {
  const f = path.join(ROOT, 'content', p.slug, 'index.md');
  if (!fs.existsSync(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/^tags: (\[.*\])$/m);
  if (!m) continue;
  let list;
  try { list = JSON.parse(m[1]); } catch { continue; }
  const out = [];
  for (const t of list) {
    const c = pick(t.trim());
    if (c !== t.trim()) merged++;
    if (!out.includes(c)) out.push(c);       // 합치면서 겹치는 것은 하나로
  }
  const next = src.replace(/^tags: \[.*\]$/m, `tags: ${JSON.stringify(out)}`);
  if (next !== src) { fs.writeFileSync(f, next); changed++; }
}
console.log(`태그 표기 통일: ${changed}편 수정, ${merged}개 태그를 대표 표기로 합침`);
