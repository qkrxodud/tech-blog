// 남은 학습노트 39편의 배치 계획.
// 원본 제목 조각 → slug·카테고리·연재 위치를 정하고, 원본 경로와 작성일을 붙여
// /tmp/plan.json 으로 떨군다. 변환 에이전트는 이 파일만 보고 일하면 된다.
const fs = require('fs');
const path = require('path');

const EXPORT = '/Users/taeyoung/Downloads/Export-c1198803-3981-4e38-9804-6e391f86aed6';
// 노션 제목에는 줄바꿈 없는 공백(U+00A0)이 섞여 있어 눈으로는 같아 보여도 대조가 어긋난다.
const nfc = s => s.normalize('NFC').replace(/ /g, ' ');

// [제목에서 찾을 조각, slug, 카테고리, 연재, 편]
const PLAN = [
  // 스프링 핵심 원리 — 강의 커리큘럼 순서대로 기존 8편 사이에 끼워 넣는다
  ['객체 지향 설계와 스프링',        'spring-core-oop-design',        'spring', '스프링 핵심 원리', 1],
  ['AppConfig 리팩터링',             'spring-core-appconfig-refactor','spring', '스프링 핵심 원리', 3],
  ['스프링 빈 으로 전환하기',        'spring-core-bean-conversion',   'spring', '스프링 핵심 원리', 4],
  ['BeanFactory와 ApplicationContext','spring-core-beanfactory',      'spring', '스프링 핵심 원리', 5],
  ['XML로 AppConfig',                'spring-core-xml-config',        'spring', '스프링 핵심 원리', 6],
  ['웹 애플리케이션을 싱글톤',       'spring-core-singleton-web',     'spring', '스프링 핵심 원리', 7],
  ['싱글톤 방식의 주의 점',          'spring-core-singleton-caution', 'spring', '스프링 핵심 원리', 8],
  ['애노테이션 직접 만들기',         'spring-core-custom-annotation', 'spring', '스프링 핵심 원리', 13],
  ['자동, 수동의 올바른 실무',       'spring-core-auto-manual',       'spring', '스프링 핵심 원리', 14],
  ['Provider로 해결',                'spring-core-provider',          'spring', '스프링 핵심 원리', 17],

  // 스프링 입문
  ['컴포넌트 스캔과 자동 의존관계',  'spring-intro-component-scan',   'spring', '스프링 입문', 4],
  ['자바 코드로 직접 스프링 빈',     'spring-intro-java-config',      'spring', '스프링 입문', 5],
  ['h2 데이터베이스 설치',           'spring-intro-h2',               'spring', '스프링 입문', 7],
  ['스프링 통합 테스트',             'spring-intro-integration-test', 'spring', '스프링 입문', 9],
  ['스프링 데이터 JPA & 통합 테스트','spring-intro-data-jpa',         'spring', '스프링 입문', 11],
  ['AOP가 필요한 상황',              'spring-intro-aop',              'spring', '스프링 입문', 12],

  // HTTP 웹 기본 지식
  ['URI와 웹 브라우저 요청 흐름',    'http-uri-flow',                 'network', 'HTTP 웹 기본 지식', 2],
  ['HTTP 메서드 활용',               'http-method-usage',             'network', 'HTTP 웹 기본 지식', 5],

  // 클린 코드 with Java
  ['Step1 레거시 코드 리팩터링',     'ccj-legacy-refactor',      'clean-code-java', '클린 코드 with Java', 1],
  ['1단계 - 문자열 계산기',          'ccj-string-calculator-step1','clean-code-java','클린 코드 with Java', 4],
  ['수강신청(도메인 모델)',          'ccj-enrollment-domain',    'clean-code-java', '클린 코드 with Java', 15],
  ['수강신청(DB 적용)',              'ccj-enrollment-db',        'clean-code-java', '클린 코드 with Java', 16],

  // JPA 계열
  ['즉시 로딩과 지연 로딩',          'jpa-lazy-eager-loading',        'spring-jpa', '자바 ORM 표준 JPA', 8],
  ['스프링 데이터 JPA 분석',         'data-jpa-internals',            'spring-jpa', '스프링 데이터 JPA', 6],
  ['실무 필수 최적화',               'boot-jpa-advanced-optimization','spring-jpa', '스프링 부트와 JPA 활용', 4],

  // 아파치 카프카 — 새 연재로 묶는다 (기존 '생태계' 글이 2편에 들어간다)
  ['아파치 카프카의 기본 구조',      'kafka-basics',                  'kafka', '아파치 카프카 입문', 1],
  ['카프카 로컬 환경설정',           'kafka-local-setup',             'kafka', '아파치 카프카 입문', 3],
  ['아파치 카프카 CLI 활용',         'kafka-cli',                     'kafka', '아파치 카프카 입문', 4],

  // 단독 글
  ['@Validation',                    'java-validation',               'spring',   null, null],
  ['함수모음',                       'java-null-safe-functions',      'java-jvm', null, null],
  ['Duplicate Key Error',            'java-stream-duplicate-key',     'java-jvm', null, null],
  ['NoUniqueBeanDefinitionException','spring-no-unique-bean',         'spring',   null, null],
  ['NPE 발생',                       'java-npe-defensive-code',       'java-jvm', null, null],
  ['LazyInitializationException',    'jpa-lazy-init-exception',       'spring-jpa', null, null],
  ['@Transcation 롤백 안되는 현상',  'transaction-rollback-proxy-2',  'spring',   null, null],
  ['커넥션풀과 데이터소스',          'spring-db-connection-pool',     'database', null, null],
  ['바이너리 서치 트리',             'algo-binary-search-tree',       'algorithm', null, null],
  ['프로그래머스 완전 탐색',         'algo-brute-force',              'algorithm', null, null],
  ['API & Filter',                   'spring-security-filters',       'spring',   null, null],
];

const todo = JSON.parse(fs.readFileSync('/tmp/todo.json', 'utf8'));
const MONTH = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;

const out = [];
const used = new Set();
for (const [needle, slug, category, series, seriesOrder] of PLAN) {
  const hits = todo.filter(r => nfc(r.t).includes(nfc(needle)) && !used.has(r.p));
  if (!hits.length) { console.error(`✗ 원본 못 찾음: ${needle}`); continue; }
  // 같은 제목이 여러 벌이면 긴 쪽(내용이 더 남은 쪽)을 쓴다
  hits.sort((a, b) => b.n - a.n);
  const r = hits[0];
  used.add(r.p);

  const src = path.join(EXPORT, r.p);
  const head = fs.readFileSync(src, 'utf8').slice(0, 900);
  const m = head.match(MONTH);
  const date = m ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : null;

  out.push({ src, slug, category, series, seriesOrder, date, origin: r.t, lines: r.n });
}

fs.writeFileSync('/tmp/plan.json', JSON.stringify(out, null, 1));
console.log(`계획 ${out.length}편 (날짜 확인 ${out.filter(o => o.date).length}편)`);
const bySeries = {};
for (const o of out) bySeries[o.series || '단독'] = (bySeries[o.series || '단독'] || 0) + 1;
for (const [k, v] of Object.entries(bySeries)) console.log(`  ${String(v).padStart(2)}  ${k}`);
