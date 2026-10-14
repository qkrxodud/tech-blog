---
title: "2024년 회고"
tags: ["회고","낙관적 락","비관적 락","분산락","캐시","DBCP"]
summary: "신규 프로젝트를 기일에 맞춰 오픈하며 겪은 락 전략, 캐시 Stampede, DBCP 설정 등 한 해 동안의 학습을 정리합니다."
---

2024년은 신규 프로젝트를 비롯해 다양한 경험을 한 한 해였습니다. 운이 좋게 신규 프로젝트를 처음부터 끝까지 맡아 기일에 맞춰 오픈하였고, 중간중간 발생한 문제를 해결하기 위해 공부한 내용도 많았습니다. 오늘은 각각의 내용을 간단하게 정리하고, 2024년에 따로 정리한 글은 링크로 남겨 기록하도록 하겠습니다.

## 신규 구축한 어드민 웹 서비스

처음으로 프로젝트를 맡아 신규로 오픈한 웹 사이트입니다.

### 패키지 분리

패키지는 아래와 같이 분리하였습니다.

```text
├── cache
└── core
│		└── domain
│				└── domainA
│				│		└──repository
│				│		│		└──domainRepository
│				│		│		└──domainRepository
│				│		└──service
│				│				└──domainService
│				└── domainB
│				└── common
├── storeage
└── web
```

1. 패키지 분리 기준
    - `cache`, `storage` 등 기술·기능 중심 패키지를 최상단에 배치하였습니다.
    - `core`는 도메인과 공통 비즈니스 로직을 포함하도록 설계하였습니다.
2. 도메인 패키지 하위 분리
    - 도메인(`domainA`, `domainB`)을 개별적으로 구성하고, 각 도메인의 엔티티, 리포지토리, 서비스, DTO 등을 세분화하였습니다.
    - 예를 들어 `domainA` 안에서 엔티티와 관련된 모든 파일을 쉽게 찾을 수 있습니다.
3. 웹 계층 분리
    - `web`에 컨트롤러와 웹 전용 로직(DTO, 예외 처리)을 한곳에 모아 두었습니다.
    - Interceptor, ArgumentResolver를 별도로 관리하여 구조를 명확히 하였습니다.
4. 공통 코드 위치
    - 모든 도메인에서 공통으로 사용하는 코드는 `core/common`으로 분리하였습니다.
    - 공통 유틸, 상수, 예외 등이 여기에 위치합니다.

### 종속성 문제 해결

종속성 문제를 해결하기 위해 패키지를 아래와 같이 구성하였습니다.

```text
├── cache
└── core
│		└── domain
│				└── domainA
│				│		└──repository
│				│		│		└──domainRepository
│				│		│		└──domainRepository
│				│		└──service
│				│				└──domainService
│				└── domainB
│				└── common
├── storeage
│		└── coroe
│				└── jpa
│				│		└── domainA
│				│		│		└── domainJpaEntity
│				│		│		└── domainJpaEntity
│				│		└── domainB
│				│				└── domainJpaEntity
│				│				└── domainJpaEntity
│				└── mybatis
│						└── domainB
│								└── domainMybatisDTO
│								└── domainMybatisDTO
├── web                  
│   ├── controller       
│   ├── dto              
│   └── exception        
└── external        
```

1. 도메인 중심의 계층화
    - `core/domain` 아래에 도메인별로 repository와 service를 두어 도메인 중심 설계를 유지하였습니다.
    - `repository`는 도메인 로직에서 직접 호출할 수 있으며, 저장소의 세부 사항은 `storeage`에 위임합니다.
    - `service`는 도메인별 비즈니스 로직의 집합으로, 핵심 기능을 캡슐화합니다.
2. 저장소 세부 사항 분리
    - `storeage/coroe` 아래에 JPA와 MyBatis를 명확히 분리하여 구현 기술별로 관리하였습니다.
    - `jpa`와 `mybatis`가 공존하더라도 서로 영향을 주지 않습니다.
    - 도메인 모델과 DB 엔티티, DTO 간의 변환은 각 계층에서 관리할 수 있습니다.
3. 웹 계층 독립
    - `web` 패키지에서 요청·응답 DTO, 컨트롤러, 예외 처리를 관리합니다.
    - 도메인 계층과 별도로 분리하여 확장성과 유지보수성을 높였습니다.
4. 확장성 확보
    - `external` 패키지로 외부 API 연동 코드를 분리하여, 다양한 외부 서비스와 통합할 수 있도록 하였습니다.
    - `cache` 패키지로 캐시 관련 로직을 통합 관리해 성능 향상을 도모하였습니다.

### 낙관적 락, 비관적 락, 분산 락

동시성 문제를 다루기 위해 세 가지 락을 정리하였습니다.

낙관적 락(Optimistic Lock)은 데이터 충돌 가능성이 낮다고 가정하고, 트랜잭션이 완료될 때까지 잠금을 걸지 않은 채 데이터를 처리하는 방법입니다. 트랜잭션이 끝날 때 데이터 변경 여부를 검증하여 충돌이 없을 경우에만 데이터를 갱신하며, 일반적으로 버전 관리(versioning)를 통해 구현합니다.

- 특징
    - 잠금을 걸지 않기 때문에 성능이 좋습니다.
    - 충돌 가능성이 높은 환경에서는 실패율이 증가할 수 있습니다.
- 사용 사례
    - 데이터 갱신 빈도가 낮고 충돌 가능성이 적은 환경입니다.
    - 데이터 일관성을 트랜잭션 종료 시점에만 보장하면 되는 경우입니다.

자세한 내용은 [DB 낙관적 락](../optimistic-lock/)에 정리하였습니다.

비관적 락(Pessimistic Lock)은 데이터 충돌 가능성이 높다고 가정하고, 트랜잭션이 시작되자마자 잠금을 걸어 다른 트랜잭션이 접근하지 못하도록 하는 방법입니다. 락을 통해 강제로 자원을 보호하며, 공유 락(Shared Lock)과 배타 락(Exclusive Lock)으로 나뉩니다.

- 특징
    - 충돌이 발생하지 않도록 보장하지만, 잠금으로 인해 성능 저하가 발생할 수 있습니다.
    - 데드락(Deadlock)이 발생할 가능성이 있습니다.
- 사용 사례
    - 데이터 갱신 빈도가 높고 충돌 가능성이 큰 환경입니다.
    - 자원의 일관성을 트랜잭션 실행 중에도 보장해야 하는 경우입니다.

자세한 내용은 [DB 비관적 락](../pessimistic-lock/)에 정리하였습니다.

분산 락(Distributed Lock)은 멀티스레드 또는 멀티 프로세스 환경에서 공유 자원에 대한 동시 접근을 제어하기 위해 사용하는 락입니다. 주로 분산 시스템에서 데이터 정합성을 보장하기 위해 사용합니다.

- 구현 방법
    - Redis: `SETNX` 명령어와 `EXPIRE`를 활용해 락을 설정합니다.
    - ZooKeeper: 분산 락 구현에 사용되는 대표적인 툴로, `ephemeral znode`를 활용합니다.
    - Database: 특정 테이블을 활용하여 락 정보를 관리합니다.
- 특징
    - 분산 환경에서 데이터 일관성을 보장합니다.
    - 구현이 복잡하고, 네트워크 지연 및 장애 상황에 대비해야 합니다.
- 사용 사례
    - 분산 시스템에서 자원 접근 동기화가 필요한 경우입니다.
    - 클러스터 환경에서 동일 데이터에 대한 경쟁 조건을 방지해야 하는 경우입니다.

자세한 내용은 [DB 분산락](../distributed-lock/)에 정리하였습니다.

### Test Code 도입

신규 프로젝트에 테스트 코드를 도입하였습니다. 테스트 코드에 대한 설명은 [4주차 발자국](../infearn-week4/)에 정리하였습니다.

### 코드 리뷰 도입

- 신규 프로젝트를 구축하면서 기존 운영 시스템에서 발생했던 문제를 개선하고자 코드 리뷰를 진행하였습니다.
- 각자 맡고 있는 개발을 설명하고, 신규 프로젝트에 적용하고 있는 코드 규칙과 문제점은 없는지 확인하였습니다.
- 코드 리뷰를 새로 도입하면서 가장 중요한 부분은 개발자들 간의 신뢰였습니다.
- 신뢰 속에서 더 좋은 방법이라고 생각될 때 편하게 말할 수 있는 분위기가 중요합니다.

### DBCP

DBCP는 데이터베이스와의 연결을 미리 생성해 풀(Pool)에 보관함으로써, 클라이언트 요청 시 매번 TCP 연결을 생성하고 해제하는 과정을 생략해 성능을 개선하는 기술입니다.

DBCP가 없는 경우에는 아래 과정을 거칩니다.

1. 클라이언트 요청 → 애플리케이션에서 TCP 연결 생성 (3-way Handshake)
2. 데이터 조회 후 TCP 연결 해제 (4-way Handshake)
3. 반복적으로 연결 생성·해제가 발생해 성능이 저하됩니다.

DBCP가 있는 경우에는 아래와 같이 동작합니다.

- 미리 생성된 연결 풀에서 Connection을 가져와 재사용합니다.
- 3-way 및 4-way Handshake 과정을 최소화해 빠른 응답을 제공합니다.

DB 설정에서 중요한 항목은 아래와 같습니다.

1. `max_connections`
    - DB가 처리할 수 있는 최대 연결 수를 적절히 설정합니다.
2. `wait_timeout`
    - 유휴 상태 연결을 자동 종료하여 불필요한 연결 점유를 방지합니다.

DBCP의 주요 설정은 아래와 같습니다.

1. `minimumIdle`
    - 유지할 유휴 연결의 최소 개수입니다.
2. `maximumPoolSize`
    - 동시에 열 수 있는 최대 연결 수입니다.
    - 최소·최대 값을 동일하게 설정하는 것이 권장됩니다.
3. `maxLifetime`
    - 연결 유효 시간입니다.
    - DB의 `wait_timeout`보다 2초 작게 설정할 필요가 있습니다.
4. `connectionTimeout`
    - 풀에서 연결을 가져오기 위한 최대 대기 시간입니다.

정리하면 아래와 같습니다.

- DB 설정(`max_connections`, `wait_timeout`)과 DBCP 설정(`minimumIdle`, `maximumPoolSize`, `maxLifetime`)을 함께 맞춰 관리해야 합니다.
- 부하가 발생하면 설정 최적화 또는 장비 증설로 대응합니다. 이를 통해 시스템 안정성과 성능을 유지할 수 있습니다.

자세한 내용은 [DBCP](../dbcp/)에 정리하였고, 처음 정리한 문서는 [[실무]DB 개념 정리](https://www.coby-blog.co.kr/c3c526eb-c94c-4c5c-a2b7-aa94f793855d#google_vignette)입니다.

### 캐시 Stampede 현상과 해결 방안

캐시 Stampede는 캐시가 만료될 때 여러 요청이 한 번에 DB로 몰리면서 DB 부하가 급증하고 성능 저하를 일으키는 현상입니다.

기존 해결 방안과 한계는 아래와 같습니다.

- 분산락 방식
    - 장점: 캐시 만료 시점에 단일 요청만 DB에 접근하도록 하여 DB 부하를 줄입니다.
    - 단점: 락을 획득하지 못한 요청은 대기하게 되어 응답 지연이 발생합니다.
- 캐시 웜업(Cache Warm-up)
    - 의미: 애플리케이션 시작 시나 특정 시점에 캐시를 미리 채워 놓는 방식입니다.
    - 방법: 배치 작업을 통해 자주 사용되는 데이터를 미리 캐시에 적재합니다.
    - 문제점
        - 리모트 캐시 서버 부하로 인한 응답 지연이 발생할 수 있습니다.
        - 캐시 웜업 대상이 누락되면 기존 문제(Stampede)가 다시 발생할 수 있습니다.

이를 보완하는 방법으로 하이브리드 캐시 솔루션이 있습니다.

- 구조: 로컬 캐시와 리모트 캐시를 함께 사용합니다.
    - 데이터 조회 순서: 로컬 캐시 → 리모트 캐시 → DB
- 데이터 특성별 캐시 활용
    - 로컬 캐시: 개인화되지 않고 업데이트 빈도가 낮은 데이터입니다.
        - 예: 마케팅 카드, 내비게이터, 리뷰 등입니다.
    - 리모트 캐시: 최신 상태를 유지해야 하는 데이터로, 모든 인스턴스에서 동일한 응답을 보장합니다.

요약하자면 아래와 같습니다.

- 캐시 Stampede를 방지하기 위한 해결책으로 분산락과 캐시 웜업 방식이 있지만 한계가 존재합니다.
- **하이브리드 캐시 솔루션**을 도입하면 로컬 캐시와 리모트 캐시의 특성을 활용하여 효율적으로 데이터를 관리할 수 있습니다.

자세한 내용은 [Cache Stampede(캐시 스템피드)](../cache-stampede/)에 정리하였습니다.

## 기존에 운영하던 어드민 웹 서비스

기존에 유지보수하고 있는 프로젝트입니다. 이 프로젝트에서는 중복 상품, 중복 모니터링 문제의 원인과 해결 방법을 찾았습니다.

원인을 분석한 내용은 아래와 같습니다.

- 기존 상태: 단일 ID(`Long`)를 사용하고, `@GeneratedValue(strategy = GenerationType.IDENTITY)`로 ID를 자동 생성하였습니다.
- 변경된 상태: 복합키(`ID + createdAt`)로 변경되었으나, JPA에서 `@GeneratedValue`를 제거하고 `@Id`만 사용하도록 수정하였으며, 기존의 조회 메서드들이 이 변경을 반영하지 않아서 중복 데이터가 반환되었습니다.

문제는 아래와 같이 해결하였습니다.

- 엔티티로 변환하지 않고 Object로 변환해서 일단 개발을 완료하였습니다.
- 파티셔닝을 변경하여 다시 적용하였습니다.

## 인프런 워밍업 클럽 백엔드 스터디 2기

인프런 워밍업 클럽 백엔드 스터디 2기에 참여하며 주차별로 발자국을 작성하였습니다.

- [1주차 발자국](../infearn-week1/)
- [2주차 발자국](../infearn-week2/)
- [3주차 발자국](../infearn-week3/)
- [4주차 발자국](../infearn-week4/)

## 2024년 수료 인프런 인터넷 강의

2024년에 수료한 인프런 강의는 아래와 같습니다.

- [오브젝트 - 기초편 강의 | 조영호 - 인프런](https://www.inflearn.com/course/%EC%98%A4%EB%B8%8C%EC%A0%9D%ED%8A%B8-%EA%B8%B0%EC%B4%88%ED%8E%B8-%EA%B0%9D%EC%B2%B4%EC%A7%80%ED%96%A5/dashboard)
- [[아파치 카프카 애플리케이션 프로그래밍] 개념부터 컨슈머, 프로듀서, 커넥트, 스트림즈까지! 강의 | 데브원영 DVWY - 인프런](https://www.inflearn.com/course/%EC%95%84%ED%8C%8C%EC%B9%98-%EC%B9%B4%ED%94%84%EC%B9%B4-%EC%95%A0%ED%94%8C%EB%A6%AC%EC%BC%80%EC%9D%B4%EC%85%98-%ED%94%84%EB%A1%9C%EA%B7%B8%EB%9E%98%EB%B0%8D)
- [Practical Testing: 실용적인 테스트 가이드 강의 | 박우빈 - 인프런](https://www.inflearn.com/course/practical-testing-%EC%8B%A4%EC%9A%A9%EC%A0%81%EC%9D%B8-%ED%85%8C%EC%8A%A4%ED%8A%B8-%EA%B0%80%EC%9D%B4%EB%93%9C?attributionToken=jAHwiwoMCOKVhLwGEMGK8uwCEAEaJDY3ODFhNmQ0LTAwMDAtMmUwZS1hNTM1LTI0MDU4ODdjODg0NCoGNDIxNTExMjCb1rctxcvzF46-nRXUsp0VwvCeFaOAlyK2t4wtqOWqLZD3sjCa7sYwjpHJMJjWty06DmRlZmF1bHRfc2VhcmNoSAFYAWABaAF6AnNp)
- [Readable Code: 읽기 좋은 코드를 작성하는 사고법 강의 | 박우빈 - 인프런](https://www.inflearn.com/course/readable-code-%EC%9D%BD%EA%B8%B0%EC%A2%8B%EC%9D%80%EC%BD%94%EB%93%9C-%EC%9E%91%EC%84%B1%EC%82%AC%EA%B3%A0%EB%B2%95/dashboard)
- [스프링 시큐리티 완전 정복 [6.x 개정판] 강의 | 정수원 - 인프런](https://www.inflearn.com/course/%EC%8A%A4%ED%94%84%EB%A7%81-%EC%8B%9C%ED%81%90%EB%A6%AC%ED%8B%B0-%EC%99%84%EC%A0%84%EC%A0%95%EB%B3%B5/dashboard)
- [Java/Spring 테스트를 추가하고 싶은 개발자들의 오답노트 강의 | 김우근 - 인프런](https://www.inflearn.com/course/%EC%9E%90%EB%B0%94-%EC%8A%A4%ED%94%84%EB%A7%81-%ED%85%8C%EC%8A%A4%ED%8A%B8-%EA%B0%9C%EB%B0%9C%EC%9E%90-%EC%98%A4%EB%8B%B5%EB%85%B8%ED%8A%B8/dashboard)

## 경험 및 인사이트

다른 회사의 경험과 인사이트는 아래 기술 블로그들을 통해 참고하였습니다.

- [카카오 개발 블로그](https://tech.kakao.com/blog)
- [당근 개발 블로그](https://medium.com/daangn)
- [토스 개발 블로그](https://toss.tech/)
- [리디 개발 블로그](https://ridicorp.com/story-category/tech-blog/)
- [컬리 개발 블로그](https://helloworld.kurly.com/)
- [네이버 개발 블로그](https://d2.naver.com/home)
- [우아한 형제 기술 블로그](https://techblog.woowahan.com/)

## 마무리

오늘은 2024년 한 해 동안 진행한 프로젝트와 공부한 내용을 정리하였습니다.

2024년에는 프로젝트를 진행하면서 다양한 방법을 고민하고, 어떻게 하면 과거 프로젝트보다 좀 더 나은 프로젝트로 만들 수 있을까 고민을 많이 하면서 작업하였습니다. 그럼에도 아직 많이 부족하다고 생각하며, "왜?"라는 질문에 명확하고 쉽게 설명할 수 있는 개발자로 방향을 잡으려고 합니다.

### 2024년에 아쉬운 점

1. 프로젝트를 진행하면서 문서화를 많이 하지 못하였습니다.
2. 인프라에 대해 쉽게 설명하지 못하였습니다.
3. 개인 프로젝트 1개는 올렸지만, 너무 간단한 프로젝트였습니다.
    - MBTI 롤 포지션 — [GitHub](https://github.com/qkrxodud/LoLXMBTICalcuator)

### 2025년 목표

1. 개발 책을 8권 이상 읽겠습니다.
2. 인프라를 공부하겠습니다.
3. 사용자가 유입될 수 있는 개인 프로젝트를 2개 이상 진행하겠습니다.
4. 다른 사람들에게 설명할 수 있는 자리를 적극적으로 마련하겠습니다.

2025년에도 속도보다 방향으로 발전하는 사람이 되겠습니다.
