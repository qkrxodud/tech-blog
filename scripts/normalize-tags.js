// 글마다 손으로 단 태그라 같은 말이 여러 표기로 갈렸다("Java"와 "자바",
// "클린코드"와 "클린 코드"). 태그로 글을 모아 보려면 먼저 표기를 하나로 맞춰야 한다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));

// 대표 표기로 모을 것들. 왼쪽이 대표, 오른쪽이 같은 뜻으로 볼 표기들.
const MERGE = {
  "Java": ["자바", "JAVA", "java", "Java 21"],
  "Spring": ["스프링"],
  "Spring Boot": ["SpringBoot", "스프링부트", "스프링 부트"],
  "JPA": ["jpa"],
  "Spring Data JPA": ["스프링 데이터 JPA", "스프링데이터JPA"],
  "Claude Code": ["ClaudeCode"],
  "Ralph Loop": ["RalphLoop"],
  "AI 협업": ["AI협업", "AI 코딩", "AI코딩"],
  "G1 GC": ["G1GC"],
  "GC": ["가비지 컬렉션", "가비지컬렉션", "Garbage Collection", "Full GC", "Stop-The-World"],
  "의존성 역전": ["의존성역전", "DIP"],
  "슬로우 쿼리": ["슬로우쿼리"],
  "비관적 락": ["비관적락", "선점 잠금"],
  "낙관적 락": ["낙관적락", "비선점 잠금"],
  "분산락": ["분산 락"],
  "B-Tree": ["BTree", "B-tree", "B tree"],
  "응용 서비스": ["응용서비스"],
  "클린 아키텍처": ["클린아키텍처"],
  "육각형 아키텍처": ["육각형아키텍처", "헥사고날 아키텍처", "헥사고날아키텍처", "웹 어댑터", "영속성 어댑터", "아웃고잉 포트"],
  "클린 코드": ["클린코드", "Clean Code", "CleanCode"],
  "일급 컬렉션": ["일급컬렉션"],
  "정적 팩토리 메서드": ["정적팩토리메서드", "정적 팩토리 메소드", "정적 팩터리 메서드"],
  "테스트 코드": ["테스트코드", "테스트", "Mockito", "MockBean", "SpyBean"],
  "의존성 주입": ["의존관계주입", "의존관계 주입", "DI", "의존관계자동주입", "자동 의존관계"],
  "DB": ["데이터베이스"],
  "스프링 빈": ["스프링빈", "빈등록", "빈생명주기"],
  "스프링 컨테이너": ["스프링컨테이너"],
  "컴포넌트 스캔": ["컴포넌트스캔", "Component Scan", "ComponentScan"],
  "단위 테스트": ["단위테스트"],
  "영속성 컨텍스트": ["영속성컨텍스트"],
  "연관관계 매핑": ["연관관계매핑", "연관 관계 매핑"],
  "어노테이션": ["애노테이션", "애너테이션"],
  "네이밍 컨벤션": ["네이밍컨벤션"],
  "커밋 메시지": ["커밋메시지"],
  "커밋 컨벤션": ["커밋컨벤션"],
  "리팩터링": ["리팩토링"],
  "ElasticSearch": ["Elasticsearch", "elasticsearch", "ES"],
  "역인덱스": ["역색인"],
  "Querydsl": ["QueryDSL", "querydsl"],
  "Kafka": ["카프카", "Spring Kafka"],
  "MySQL": ["mysql"],
  "Redis": ["redis"],
  "동시성": ["동시성 제어", "동시성제어"],
  "DDD": ["도메인 주도 개발", "도메인주도개발"],
  "성능 최적화": ["성능최적화"],
  "Cascade": ["CASCADE"],
  "디자인 패턴": ["디자인패턴"],
  "Bean Validation": ["BeanValidation", "유효성검증", "Validation"],
  "관심사 분리": ["관심사분리"],
  "HTTP 메서드": ["HTTP메서드"],
  "백로그": ["BACKLOG"],
  "트랜잭션": ["트랜잭션 ACID", "트랜잭션 전파", "트랜잭션 범위", "트랜잭션 격리 수준"],
  "스레드": ["멀티스레드", "멀티 쓰레드"],
  "애그리거트": ["애그리거트 루트"],
  "아키텍처": ["아키텍처 설계", "아키텍처경계", "계층형 아키텍처", "Layered Architecture"],
  "독서": ["독서기록"],
  "매핑": ["매핑 전략", "양방향 매핑", "단방향 매핑", "상속매핑", "DTO 매핑", "상속관계 매핑", "기본 키 매핑", "DB 매핑"],
  "추상화": ["추상화 수준", "자료 추상화"],
  "회고": ["개발 회고"],
  "인덱스": ["DB인덱스", "복합인덱스", "커버링 인덱스", "데이터베이스 인덱스"],
  "페이징": ["페이지네이션", "No Offset", "Pageable"],
  "쿼리 최적화": ["쿼리튜닝", "실행계획", "옵티마이저"],
  "SOLID": ["단일 책임 원칙", "인터페이스 분리 원칙"],
  "Kubernetes": ["쿠버네티스"],
  "Stream": ["스트림"],
  "플러시": ["flush"],
  "전략 패턴": ["Strategy Pattern"],
  "JUnit": ["JUnit5"],
  "NullPointerException": ["NPE"],
  "롤백": ["rollbackFor"],
  "MVC": ["MVC 패턴"],
  "리포지토리": ["Repository", "리포지토리 패턴"],
  "@Entity": ["Entity"],
  "@Bean": ["Bean"],
  "CGLIB": ["CGLIB프록시"],
  "bool query": ["bool쿼리"],
  "JIT": ["JIT 컴파일러"],
  "가독성": ["코드 가독성"],
  "URI": ["URI설계"],
  "오케스트레이션": ["컨테이너오케스트레이션"],
  "Test Double": ["Mock", "Fake"],
  "예외 처리": ["checked Exception", "RuntimeException"],
  "연관관계": ["다대일", "일대다", "일대일", "단방향", "양방향", "연관관계의 주인"],
  "빈스코프": ["프로토타입스코프", "웹스코프", "request스코프"],
  "자료구조": ["이진탐색트리", "트리", "스택", "큐", "해시", "배열"],
  "알고리즘": ["완전탐색"],
  "네이밍 컨벤션": ["네이밍"],
  "무상태": ["스테이트리스"],
};

// 덜어낼 태그. 뜻이 너무 두루뭉술해 어떤 글인지 알려 주지 못하고, 이것만 보고
// 글을 찾아올 사람도 없다. 글의 내용은 다른 태그가 이미 말해 주고 있다.
// (반대로 "경계", "함수", "주석"처럼 두루뭉술해 보여도 그 글의 주제 자체인
//  것은 남긴다 — 클린 코드 각 장의 제목이다.)
const DROP = new Set([
  '자동화', '상태관리', '트러블슈팅', '실무팁', '용어정리', '스터디',
  '웹', '환경설정', '설정관리', 'DL', '인프라', '문법',
]);

// 닮았지만 다른 것들 — 자동으로 묶이지 않게 여기 적어 둔다.
// MVCC(다중 버전 동시성 제어)는 MVC와 아무 관계가 없다.
// 자기 호출(self-invocation)은 프록시와 얽혀 있지만 같은 말이 아니다.

// 별칭 → 대표 표기
const canon = {};
for (const [main, aliases] of Object.entries(MERGE)) {
  canon[main.toLowerCase().replace(/[\s_-]/g, '')] = main;
  for (const a of aliases) canon[a.toLowerCase().replace(/[\s_-]/g, '')] = main;
}
const pick = t => canon[t.toLowerCase().replace(/[\s_-]/g, '')] || t;

let changed = 0, merged = 0, dropped = 0;
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
    if (DROP.has(t.trim())) { dropped++; continue; }
    const c = pick(t.trim());
    if (c !== t.trim()) merged++;
    if (!out.includes(c)) out.push(c);       // 합치면서 겹치는 것은 하나로
  }
  const next = src.replace(/^tags: \[.*\]$/m, `tags: ${JSON.stringify(out)}`);
  if (next !== src) { fs.writeFileSync(f, next); changed++; }
}
console.log(`태그 표기 통일: ${changed}편 수정, ${merged}개를 대표 표기로 합침, ${dropped}개를 덜어냄`);
