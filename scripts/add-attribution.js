// 강의 노트 하단의 출처 표기를 한 형식으로 맞춘다.
// 원본에 출처가 있던 글과 없던 글이 섞여 있어, 표기가 제각각이면 어수선하다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));

// 시리즈(또는 카테고리) → 출처 한 줄
const SOURCE = {
  '스프링 입문': '인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)',
  '스프링 핵심 원리': '인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)',
  '스프링 MVC': '인프런 김영한 님의 [스프링 MVC 1편 — 백엔드 웹 개발 핵심 기술](https://www.inflearn.com/course/스프링-mvc-1)',
  '자바 ORM 표준 JPA': '인프런 김영한 님의 [자바 ORM 표준 JPA 프로그래밍 — 기본편](https://www.inflearn.com/course/ORM-JPA-Basic)',
  '스프링 데이터 JPA': '인프런 김영한 님의 [실전! 스프링 데이터 JPA](https://www.inflearn.com/course/스프링-데이터-JPA-실전)',
  'Querydsl': '인프런 김영한 님의 [실전! Querydsl](https://www.inflearn.com/course/querydsl-실전)',
  '스프링 부트와 JPA 활용': '인프런 김영한 님의 [실전! 스프링 부트와 JPA 활용](https://www.inflearn.com/course/스프링부트-JPA-활용-1)',
  'HTTP 웹 기본 지식': '인프런 김영한 님의 [모든 개발자를 위한 HTTP 웹 기본 지식](https://www.inflearn.com/course/http-웹-네트워크)',
  '클린 코드 with Java': '넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정',
  // 알고리즘 노트는 원본에 출처가 없어 표기하지 않는다(추측해서 달지 않는다).
  'infra': '인프런의 [초보를 위한 쿠버네티스 안내서](https://www.inflearn.com/course/쿠버네티스-입문)',
};

const MARK = '> 이 글은 ';
// 원본에 있던 출처 문구들 — 새 표기로 갈아 끼우기 위해 찾아낸다.
const OLD_PATTERNS = [
  /\n+이 글은 인프런[^\n]*정리했습니다\.\s*$/,
  /\n+제목\s*:[^\n]*\n+강사\s*:[^\n]*\s*$/,
  /\n+강사\s*:[^\n]*\s*$/,
  /\n+출처\s*:[^\n]*\s*$/,
  /\n+>\s*이 글은[^\n]*\s*$/,
];

let changed = 0, skipped = 0;
for (const p of posts) {
  const key = p.series || p.category;
  const src = SOURCE[key];
  if (!src) continue;
  const f = path.join(ROOT, 'content', p.slug, 'index.md');
  if (!fs.existsSync(f)) continue;

  let body = fs.readFileSync(f, 'utf8').replace(/\s+$/, '');
  for (const re of OLD_PATTERNS) body = body.replace(re, '');
  const line = `${MARK}${src}을 들으며 정리한 노트입니다.`;
  const next = `${body.replace(/\s+$/, '')}\n\n${line}\n`;
  const before = fs.readFileSync(f, 'utf8');
  if (before === next) { skipped++; continue; }
  fs.writeFileSync(f, next);
  changed++;
}
console.log(`출처 표기 정리: ${changed}건 수정, ${skipped}건 이미 동일`);
