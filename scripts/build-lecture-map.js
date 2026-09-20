// 강의 노트 원본 목록(제목 + 경로)을 읽어 posts.json에 넣을 항목으로 만든다.
// 강의별 시리즈와 순서는 아래 SERIES 표로 정한다.
const fs = require('fs');

// macOS 파일명에서 온 한글은 자모가 분리된 NFD로 들어온다. 이 파일에 적은
// 한글은 NFC라 정규화 없이 비교하면 눈에 같아 보여도 매칭되지 않는다.
const nfc = s => s.normalize('NFC');

const rows = fs.readFileSync('/tmp/paths.tsv', 'utf8').trim().split('\n')
  .map(l => { const [title, src] = l.split('\t'); return { title: nfc(title), src: nfc(src) }; });

// 발행하지 않을 글
const SKIP = [
  'SpringBatchPerformance',           // 유튜브 강연 슬라이드 필기 — 본인 해석이 거의 없음
  'GC를 이해하기 위해 알아야 되는 OS 지식', // jvm-execution-classloading으로 이미 발행
];

// [제목에 포함된 문자열, slug, 카테고리, 시리즈, 순서]
const MAP = [
  // 스프링 입문
  ['[Spring 입문] 스플링 웹 개발 기초', 'spring-intro-web-basics', 'spring', '스프링 입문', 1],
  ['[Spring 입문] 회원 관리 예제 - 백엔드 개발(1)', 'spring-intro-member-backend-1', 'spring', '스프링 입문', 2],
  ['[Spring 입문] 회원 관리 예제 - 백엔드 개발(2)', 'spring-intro-member-backend-2', 'spring', '스프링 입문', 3],
  ['[Spring 입문] 회원 웹 기능', 'spring-intro-member-web', 'spring', '스프링 입문', 4],
  ['[Spring 입문] 순수 JDBC', 'spring-intro-jdbc', 'spring', '스프링 입문', 5],
  ['[Spring 입문] 스프링 JPA 통합 테스트', 'spring-intro-jpa-test', 'spring', '스프링 입문', 6],

  // 스프링 핵심 원리
  ['[스프링 핵심원리 기본] 예제 만들기', 'spring-core-example', 'spring', '스프링 핵심 원리', 1],
  ['[스프링 핵심원리 기본] 싱글톤 컨테이너', 'spring-core-singleton', 'spring', '스프링 핵심 원리', 2],
  ['[스프링 핵심원리 기본] 컴포넌트 스캔', 'spring-core-component-scan', 'spring', '스프링 핵심 원리', 3],
  ['[스프링 핵심원리 기본] 의존관계 자동 주입 - 생성자 주입', 'spring-core-constructor-injection', 'spring', '스프링 핵심 원리', 4],
  ['[스프링 핵심원리 기본] 의존관계 자동 주입 - 조회 빈', 'spring-core-bean-conflict', 'spring', '스프링 핵심 원리', 5],
  ['[스프링 핵심원리 기본] 빈 생명주기 콜백', 'spring-core-bean-lifecycle', 'spring', '스프링 핵심 원리', 6],
  ['[스프링 핵심원리 기본] 빈 스코프 - 프로토타입', 'spring-core-prototype-scope', 'spring', '스프링 핵심 원리', 7],
  ['[스프링 핵심원리 기본] 빈 스코프 - 웹 스코프', 'spring-core-web-scope', 'spring', '스프링 핵심 원리', 8],

  // 스프링 MVC
  ['[Spring MVC] 웹 애플리케이션 이해', 'spring-mvc-web-app', 'spring', '스프링 MVC', 1],
  ['[Spring MVC] 서블릿, JSP, MVC 패턴', 'spring-mvc-servlet-jsp-pattern', 'spring', '스프링 MVC', 3],
  ['[Spring MVC] 서블릿', 'spring-mvc-servlet', 'spring', '스프링 MVC', 2],
  ['[Spring MVC] MVC 프레임워크 만들기', 'spring-mvc-framework', 'spring', '스프링 MVC', 4],

  // 자바 ORM 표준 JPA
  ['[Spring JPA] JPA 시작하기', 'jpa-getting-started', 'spring-jpa', '자바 ORM 표준 JPA', 1],
  ['[Spring JPA] JPA 영속성 컨텍스트', 'jpa-persistence-context', 'spring-jpa', '자바 ORM 표준 JPA', 2],
  ['[Spring JPA] JPA 엔티티 매핑', 'jpa-entity-mapping', 'spring-jpa', '자바 ORM 표준 JPA', 3],
  ['[Spring JPA] 연관관계 맵핑 기초', 'jpa-association-basics', 'spring-jpa', '자바 ORM 표준 JPA', 4],
  ['[Spring JPA] 다양한 연관관계 맵핑', 'jpa-association-types', 'spring-jpa', '자바 ORM 표준 JPA', 5],
  ['[Spring JPA] 고급 맵핑', 'jpa-advanced-mapping', 'spring-jpa', '자바 ORM 표준 JPA', 6],
  ['[Spring JPA] 프록시', 'jpa-proxy', 'spring-jpa', '자바 ORM 표준 JPA', 7],
  ['[Spring JPA] 영속성 전이', 'jpa-cascade', 'spring-jpa', '자바 ORM 표준 JPA', 8],
  ['[Spring JPA] 값 타입 - 기본값 타입', 'jpa-value-types', 'spring-jpa', '자바 ORM 표준 JPA', 9],
  ['[Spring JPA] 값 타입 과 불변 객체', 'jpa-immutable-value-types', 'spring-jpa', '자바 ORM 표준 JPA', 10],
  ['[Spring JPA] 객체지향 쿼리 언어1', 'jpa-jpql-basics', 'spring-jpa', '자바 ORM 표준 JPA', 11],
  ['[Spring JPA] 객체지향 쿼리 언어2', 'jpa-jpql-advanced', 'spring-jpa', '자바 ORM 표준 JPA', 12],

  // 스프링 데이터 JPA
  ['[실전! 스프링 데이터 JPA] 프로젝트 환경설정', 'data-jpa-setup', 'spring-jpa', '스프링 데이터 JPA', 1],
  ['[실전! 스프링 데이터 JPA] 예제 도메인 모델', 'data-jpa-domain-model', 'spring-jpa', '스프링 데이터 JPA', 2],
  ['[실전! 스프링 데이터 JPA] 공통 인터페이스', 'data-jpa-common-interface', 'spring-jpa', '스프링 데이터 JPA', 3],
  ['[실전! 스프링 데이터 JPA] 쿼리 메소드', 'data-jpa-query-methods', 'spring-jpa', '스프링 데이터 JPA', 4],
  ['[실전! 스프링 데이터 JPA] 확장 기능', 'data-jpa-extensions', 'spring-jpa', '스프링 데이터 JPA', 5],

  // Querydsl
  ['[Querydsl] Querydsl - 프로잭트 생성', 'querydsl-setup', 'spring-jpa', 'Querydsl', 1],
  ['[Querydsl] 예제 도메인 모델', 'querydsl-domain-model', 'spring-jpa', 'Querydsl', 2],
  ['[Querydsl] 기본문법', 'querydsl-basics', 'spring-jpa', 'Querydsl', 3],
  ['[Querydsl] 중급문법', 'querydsl-intermediate', 'spring-jpa', 'Querydsl', 4],
  ['[Querydsl] 실무 활용 - 순수 JPA', 'querydsl-pure-jpa', 'spring-jpa', 'Querydsl', 5],
  ['[Querydsl] 실무 활용 - 스프링 데이터 JPA', 'querydsl-spring-data', 'spring-jpa', 'Querydsl', 6],

  // 스프링 부트와 JPA 활용
  ['[스프링부트와 JPA 활용] API 기본', 'boot-jpa-api-basics', 'spring-jpa', '스프링 부트와 JPA 활용', 1],
  ['[스프링부트와 JPA 활용] API 개발 고급 - 지연 로딩', 'boot-jpa-lazy-loading', 'spring-jpa', '스프링 부트와 JPA 활용', 2],
  ['[스프링부트와 JPA 활용] API 개발 고급 - 컬렉션 조회', 'boot-jpa-collection-query', 'spring-jpa', '스프링 부트와 JPA 활용', 3],

  // 클린 코드 with Java (단계별 과제)
  ['1 [클린 코드 with Java] 1단계 - 스트림', 'ccj-01-stream-lambda-optional', 'clean-code-java', '클린 코드 with Java', 1],
  ['2 [클린 코드 with Java] 1단계 - 학습 테스트', 'ccj-02-learning-test', 'clean-code-java', '클린 코드 with Java', 2],
  ['3 [클린 코드 with Java] 2단계 - 문자열 덧셈 계산기', 'ccj-03-string-calculator', 'clean-code-java', '클린 코드 with Java', 3],
  ['2 [클린 코드 with Java] 2단계 - 로또(자동)', 'ccj-04-lotto-auto', 'clean-code-java', '클린 코드 with Java', 4],
  ['3 [클린 코드 with Java] 3단계 - 로또 게임(2등)', 'ccj-05-lotto-second-prize', 'clean-code-java', '클린 코드 with Java', 5],
  ['4 [클린 코드 with Java] 4단계 - 로또 수동', 'ccj-06-lotto-manual', 'clean-code-java', '클린 코드 with Java', 6],
  ['2 [클린 코드 with Java] 2단계 - 2단계 - 사다리(생성)', 'ccj-07-ladder-create', 'clean-code-java', '클린 코드 with Java', 7],
  ['3 [클린 코드 with Java] 3단계 - 사다리(게임 실행)', 'ccj-08-ladder-run', 'clean-code-java', '클린 코드 with Java', 8],
  ['4 [클린 코드 with Java] 4단계 - 사다리(리팩터링)', 'ccj-09-ladder-refactor', 'clean-code-java', '클린 코드 with Java', 9],
  ['4 [클린 코드 with Java] 3단계 - 자동차경주', 'ccj-10-racing-car', 'clean-code-java', '클린 코드 with Java', 10],
  ['5 [클린 코드 with Java] 4단계 - 자동차 경주 우승자', 'ccj-11-racing-winner', 'clean-code-java', '클린 코드 with Java', 11],
  ['6 [클린 코드 with Java] 5단계 - 자동차 경주(리팩토링)', 'ccj-12-racing-refactor', 'clean-code-java', '클린 코드 with Java', 12],

  // HTTP
  ['[HTTP] 인터넷 네트워크', 'http-internet-network', 'network', 'HTTP 웹 기본 지식', 1],
  ['HTTP 메서드', 'http-methods', 'network', 'HTTP 웹 기본 지식', 3],
  ['HTTP', 'http-basics', 'network', 'HTTP 웹 기본 지식', 2],

  // 인프라
  ['쿠버네티스 알아보기', 'kubernetes-intro', 'infra', null, null],
  ['컨테이너 오케이스트레이션', 'container-orchestration', 'infra', null, null],
  ['아파치 카프카의 생태계', 'kafka-ecosystem', 'kafka', null, null],
  ['YAML 문법', 'yaml-syntax', 'infra', null, null],

  // 알고리즘
  ['Array(1, 2차원 배열)', 'algo-array', 'algorithm', null, null],
  ['Stack, Queue', 'algo-stack-queue', 'algorithm', null, null],
  ['HashMap, TreeSet', 'algo-hashmap-treeset', 'algorithm', null, null],
  ['BFS&DFS', 'algo-bfs-dfs', 'algorithm', null, null],
  ['Two pointer, Sliding window', 'algo-two-pointer', 'algorithm', null, null],
  ['sorting and searching', 'algo-sorting-searching', 'algorithm', null, null],
  ['문자열', 'algo-string', 'algorithm', null, null],
  ['프로그래머스 해쉬', 'algo-programmers-hash', 'algorithm', null, null],
  ['프로그래머스 정렬', 'algo-programmers-sort', 'algorithm', null, null],

  // 자바 단편
  ['[Java] Stream을 활용한 예제 모음', 'java-stream-examples', 'java-jvm', null, null],
  ['2장 객체 생성과 파괴', 'effective-java-ch2', 'oop-design', null, null],
];

const used = new Set();
const out = [];
const unmatched = [];

for (const row of rows) {
  if (SKIP.some(s => row.title.includes(s))) continue;
  // 가장 길게 일치하는 항목을 고른다(짧은 키가 먼저 걸리는 것을 막는다).
  const hit = MAP.filter(m => row.title.includes(m[0]))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (!hit) { unmatched.push(row.title); continue; }
  if (used.has(hit[1])) { unmatched.push(`중복 매칭: ${row.title} → ${hit[1]}`); continue; }
  used.add(hit[1]);
  const item = { src: row.src, slug: hit[1], category: hit[2] };
  if (hit[3]) { item.series = hit[3]; item.seriesOrder = hit[4]; }
  item.sourceTitle = row.title;
  out.push(item);
}

const unusedKeys = MAP.filter(m => !used.has(m[1])).map(m => m[0]);
console.log(`매칭 ${out.length}건 / 미매칭 ${unmatched.length}건 / 안 쓰인 규칙 ${unusedKeys.length}건`);
if (unmatched.length) console.log('\n[미매칭]\n  ' + unmatched.join('\n  '));
if (unusedKeys.length) console.log('\n[안 쓰인 규칙]\n  ' + unusedKeys.join('\n  '));

fs.writeFileSync('/tmp/lecture-map.json', JSON.stringify(out, null, 2));
