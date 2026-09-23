// 글 끝의 출처 줄을 한 가지 형식으로 맞춘다.
// 옮긴 시점이 달라 「강의명」 형태와 [강의명](링크) 형태가 섞여 있었다.
const fs = require('fs');
const path = require('path');

const CONTENT = path.join(__dirname, '..', 'content');

// 강의를 알아볼 수 있는 조각 → 최종 출처 줄.
// 링크는 이미 블로그에 쓰이던 것만 쓴다. 주소를 모르는 강의는 링크 없이 둔다.
const LINES = [
  [/스프링 핵심 원리/, '> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.'],
  [/모든 개발자를 위한 HTTP/, '> 이 글은 인프런 김영한 님의 [모든 개발자를 위한 HTTP 웹 기본 지식](https://www.inflearn.com/course/http-웹-네트워크)을 들으며 정리한 노트입니다.'],
  [/자바 ORM 표준 JPA/, '> 이 글은 인프런 김영한 님의 [자바 ORM 표준 JPA 프로그래밍 — 기본편](https://www.inflearn.com/course/ORM-JPA-Basic)을 들으며 정리한 노트입니다.'],
  [/실전! 스프링 데이터 JPA/, '> 이 글은 인프런 김영한 님의 [실전! 스프링 데이터 JPA](https://www.inflearn.com/course/스프링-데이터-JPA-실전)을 들으며 정리한 노트입니다.'],
  [/스프링 부트와 JPA 활용/, '> 이 글은 인프런 김영한 님의 [실전! 스프링 부트와 JPA 활용](https://www.inflearn.com/course/스프링부트-JPA-활용-1)을 들으며 정리한 노트입니다.'],
  [/TDD, 클린 코드 with Java/, '> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.'],
  [/스프링 입문/, '> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.'],
  [/스프링 DB 1편/, '> 이 글은 인프런 김영한 님의 「스프링 DB 1편 — 데이터 접근 핵심 원리」를 들으며 정리한 노트입니다.'],
  [/아파치 카프카 애플리케이션 프로그래밍/, '> 이 글은 인프런 최원영 님의 「아파치 카프카 애플리케이션 프로그래밍」을 들으며 정리한 노트입니다.'],
  [/스프링 시큐리티|시큐리티 강의/, '> 이 글은 스프링 시큐리티 강의를 들으며 정리한 노트입니다.'],
  [/Querydsl/, '> 이 글은 인프런 김영한 님의 [실전! Querydsl](https://www.inflearn.com/course/querydsl-실전)을 들으며 정리한 노트입니다.'],
  [/스프링 MVC/, '> 이 글은 인프런 김영한 님의 [스프링 MVC 1편 — 백엔드 웹 개발 핵심 기술](https://www.inflearn.com/course/스프링-mvc-1)을 들으며 정리한 노트입니다.'],
  [/쿠버네티스/, '> 이 글은 인프런의 [초보를 위한 쿠버네티스 안내서](https://www.inflearn.com/course/쿠버네티스-입문)을 들으며 정리한 노트입니다.'],
];

// 출처 줄로 보이는 마지막 인용 한 줄
const ATTR = /^> .*(?:정리한 노트입니다|수강하며 정리|들으며 정리|풀며 정리).*$/m;

let fixed = 0, unknown = 0;
for (const dir of fs.readdirSync(CONTENT).sort()) {
  const f = path.join(CONTENT, dir, 'index.md');
  if (!fs.existsSync(f)) continue;
  const body = fs.readFileSync(f, 'utf8');
  const m = body.match(ATTR);
  if (!m) continue;

  const hit = LINES.find(([re]) => re.test(m[0]));
  if (!hit) { console.warn(`? 어느 강의인지 모를 출처: ${dir} — ${m[0]}`); unknown++; continue; }
  if (m[0] === hit[1]) continue;

  fs.writeFileSync(f, body.replace(ATTR, hit[1]));
  console.log(`· ${dir}`);
  fixed++;
}
console.log(`출처 줄 통일 ${fixed}편${unknown ? `, 판단 못 한 글 ${unknown}편` : ''}`);
