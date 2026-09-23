---
title: "영속성 컨텍스트"
tags: ["JPA","영속성 컨텍스트","더티 체킹","플러시","Hibernate"]
summary: "JPA 영속성 컨텍스트의 캐싱·더티 체킹·쓰기 지연 동작 원리와 플러시 발생 시점을 정리하고, 배치 처리와 플러시 모드를 활용한 성능 최적화 방법을 소개합니다."
---

- **설명**: 영속성 컨텍스트는 EntityManager(Hibernate에서는 Session)가 관리하는 1차 캐시로, 트랜잭션 내에서 엔티티의 상태를 추적하고 데이터베이스 동기화를 지연(Write-Behind)하여 성능을 최적화합니다. 이는 JPA/Hibernate의 핵심 메커니즘으로, 데이터 일관성과 성능을 동시에 보장합니다.
- **역할**:
    - **캐싱**: 동일 엔티티를 반복 조회 시 데이터베이스 접근 없이 1차 캐시에서 반환하며, 애플리케이션 수준 반복 읽기(Repeatable Read)를 보장합니다. 예: 동일 트랜잭션 내에서 동일 ID로 조회 시 추가 쿼리 없이 캐시를 사용합니다.
    - **변경 감지(Dirty Checking)**: 엔티티의 상태 변경을 추적하고, 플러시 시 수정된 데이터를 SQL 쿼리(UPDATE, INSERT, DELETE)로 변환합니다.
    - **쓰기 지연**: persist, merge, remove 호출 시 즉시 SQL을 실행하지 않고, 플러시 시점에 배치 처리하여 데이터베이스 왕복을 최소화합니다.
- **내부 구조**:
    - 엔티티는 Map<EntityUniqueKey, Object>에 저장되며, 각 엔티티는 로드된 상태(Loaded State, 스냅샷)와 함께 관리됩니다.
    - 로드된 상태는 더티 체킹 시 비교 기준으로 사용되어 변경된 속성을 감지합니다.
    - **스냅샷 예시**: 엔티티 로드 시 초기 상태를 저장하고, 플러시 시 현재 상태와 비교하여 변경된 속성만 SQL로 변환합니다.
- **실무 예시**: 동일 트랜잭션 내에서 동일 엔티티 조회 시 캐시를 활용해 쿼리 수를 줄일 수 있습니다.
    
    ```java
    
    Post post = entityManager.find(Post.class, 1L); // 데이터베이스 조회
    Post samePost = entityManager.find(Post.class, 1L); // 1차 캐시에서 반환, 추가 쿼리 없음
    ```
    

### 플러시 (Flushing)

- **설명**: 플러시는 영속성 컨텍스트의 변경 내용을 데이터베이스에 동기화하는 과정입니다. 더티 체킹을 통해 변경된 엔티티를 감지하고, 쓰기 지연 SQL 저장소에 INSERT, UPDATE, DELETE 쿼리를 등록하여 실행을 준비합니다. 실제 데이터베이스 반영은 트랜잭션 커밋 시 완료됩니다.
- **플러시 발생 시점**:
    - **명시적 플러시**: entityManager.flush()를 직접 호출하여 즉시 동기화합니다.
    - **트랜잭션 커밋**: 트랜잭션 커밋 직전에 자동 플러시가 발생하며, 모든 변경 사항이 반영됩니다.
    - **JPQL/Criteria 쿼리**: 쿼리 실행 전, 관련 테이블(쿼리 공간, Query Space)에 변경 사항이 있으면 자동 플러시됩니다. 이는 데이터 일관성을 보장하기 위함입니다.
    - **네이티브 SQL 쿼리**: 쿼리 공간 미등록 시 항상 플러시되고, 등록 시 관련 테이블만 플러시됩니다(예: addSynchronizedEntityClass 사용).
- **플러시 모드**:
    - **AUTO (기본값)**: 트랜잭션 커밋 또는 JPQL 쿼리 실행 전 플러시됩니다. Hibernate 5.2 이후 JPA 표준과 동기화되어 쿼리 관련 테이블만 플러시합니다.
    - **COMMIT**: 트랜잭션 커밋 시에만 플러시되어, 쿼리 전 플러시를 생략함으로써 성능이 향상됩니다.
    - **ALWAYS (Hibernate 전용)**: 모든 쿼리 실행 전 플러시되며, 불필요한 플러시로 성능이 저하될 위험이 있습니다.
    - **MANUAL (Hibernate 전용)**: 명시적 플러시만 수행하며, 고급 최적화 시 사용합니다.
    - **설정 예시**:
        
        ```java
        entityManager.setFlushMode(FlushModeType.COMMIT); // JPA
        session.setHibernateFlushMode(FlushMode.MANUAL); // Hibernate
        ```
        
- **실무 예시**: JPQL 실행 전 자동 플러시로 데이터 일관성을 보장합니다.
    
    ```java
    
    Post post = new Post("Hibernate");
    post.setId(1L);
    entityManager.persist(post);
    List<Post> posts = entityManager.createQuery("SELECT p FROM Post p", Post.class).getResultList();
    // JPQL 실행 전 자동 플러시, INSERT 쿼리 실행
    ```
    

### 성능 최적화

- **쓰기 지연과 배치 처리**:
    - persist, merge, remove 호출 시 SQL을 즉시 실행하지 않고, 플러시 시점에 배치 처리로 데이터베이스 왕복을 최소화합니다.
    - **배치 처리 설정**: hibernate.jdbc.batch_size=50, hibernate.order_inserts=true, hibernate.order_updates=true로 동일 테이블의 SQL을 그룹화하여 성능을 향상시킵니다.
    - **ID 생성 연계**: 대규모 배치 처리 시 GenerationType.SEQUENCE(예: allocationSize=50)로 ID를 사전 할당하고, 플러시와 결합하여 배치 삽입을 최적화합니다. 예: 100만 건 삽입 시 hibernate.jdbc.batch_size=100과 주기적 flush로 처리 속도를 10배 향상시킬 수 있습니다.
        
        ```java
        @Entity
        public class Post {
            @Id @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "post_seq")
            @SequenceGenerator(name = "post_seq", sequenceName = "post_sequence", allocationSize = 50)
            private Long id;
            private String title;
        }
        
        ```
        
- **더티 체킹 최적화**:
    - 기본 더티 체킹은 Java 리플렉션으로 모든 속성을 비교하므로, 엔티티 또는 속성 수가 많을 경우 성능이 저하됩니다(예: 1000개 엔티티 처리 시 수백 ms 소요).
    - 바이트코드 향상(@EnableDirtyTracking)으로 변경된 속성만 추적하면 플러시 시간을 단축할 수 있습니다.
        
        **줄 바꿈 활성화 텍스트로 복사**
        
        ```java
        @Entity
        @EnableDirtyTracking
        public class Post {
            @Id @GeneratedValue
            private Long id;
            private String title;
        }
        ```
        
- **영속성 컨텍스트 관리**:
    - 대량 데이터 처리(예: 100만 건) 시 영속성 컨텍스트 크기 증가로 메모리 문제(OutOfMemoryError)가 발생할 수 있습니다.
    - 주기적 flush와 clear 호출로 관리하면 메모리 사용량을 줄이고 성능을 유지할 수 있습니다.
        
        ```java
        for (int i = 0; i < 10000; i++) {
            Post post = new Post("Post " + i);
            entityManager.persist(post);
            if (i % 1000 == 0) {
                entityManager.flush(); // 변경 사항 동기화
                entityManager.clear(); // 영속성 컨텍스트 초기화
            }
        }
        
        ```
        
- **플러시 모드 최적화**:
    - FlushMode.COMMIT으로 쿼리 실행 전 불필요한 플러시를 방지하면 트랜잭션 처리 속도가 향상됩니다.
    - 네이티브 SQL 쿼리에서 쿼리 공간을 등록하면 플러시를 최소화하고 성능을 최적화할 수 있습니다.
        
        ```java
        
        session.createSQLQuery("SELECT * FROM post")
               .addSynchronizedEntityClass(Post.class);
        ```
        
- **실무 팁**:
    - 대량 배치 처리 시 MANUAL 모드와 네이티브 쿼리 조합으로 플러시를 제어하면 메모리 사용량을 줄일 수 있습니다.
    - Hypersistence Optimizer로 불필요한 플러시(예: RedundantSessionFlushEvent)를 진단할 수 있습니다.
    - 예: 100만 건 데이터 마이그레이션 시, hibernate.jdbc.batch_size=100, 주기적 flush/clear, GenerationType.SEQUENCE 조합으로 처리 시간을 10배 단축할 수 있습니다.
- **모니터링**: Hibernate 통계(hibernate.generate_statistics=true)로 플러시 시간, 쿼리 실행 횟수, 더티 체킹 비용을 분석할 수 있습니다.

### 권장사항

- 영속성 컨텍스트 크기를 최소화하고, 주기적 flush와 clear로 메모리를 관리합니다.
- FlushMode.COMMIT 또는 MANUAL로 불필요한 플러시를 방지하여 쿼리 성능을 최적화합니다.
- 바이트코드 향상(@EnableDirtyTracking)으로 더티 체킹 성능을 개선합니다.
- 네이티브 쿼리 사용 시 쿼리 공간을 명시(addSynchronizedEntityClass)하여 플러시를 최소화합니다.
- Hibernate 통계(hibernate.generate_statistics=true)로 플러시 시간 및 배치 처리 성능을 분석하고 병목 지점을 식별합니다.
- 대량 데이터 처리 시 hibernate.jdbc.batch_size(예: 50~100)와 GenerationType.SEQUENCE(예: allocationSize=50)로 ID 생성 및 삽입을 최적화합니다.
- Hypersistence Optimizer로 플러시 및 배치 처리 비효율성(예: 불필요한 플러시, 더티 체킹 오버헤드)을 진단합니다.
- 테스트 환경에서 Testcontainers를 사용해 대량 데이터 처리 시나리오(예: 10만 건 삽입)로 성능을 검증합니다.

[세계 자바 챔피언, Vlad Mihalcea 강의 로드맵 - 인프런](https://www.inflearn.com/roadmaps/9183)
