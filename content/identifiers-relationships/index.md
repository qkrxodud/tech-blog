---
title: "식별자 (Identifiers), 관계 (Relationships)"
tags: ["JPA", "Hibernate", "연관관계 매핑", "ID 생성 전략", "N+1"]
summary: "JPA의 ID 생성 전략과 OneToMany, OneToOne, ManyToMany 연관관계 매핑에서 성능을 고려한 실무 선택 기준을 정리합니다."
---

### **4.1 ID 생성 전략**

- **영속화 시 필수 ID**: JPA 엔티티는 영속성 컨텍스트에서 고유하게 식별되기 위해 반드시 ID를 가져야 합니다. 이는 엔티티의 생명주기 관리(예: persist, merge, remove)와 데이터베이스 매핑의 핵심입니다. ID가 없으면 `EntityExistsException` 또는 유사한 오류가 발생할 수 있습니다.
- **오토 인크리먼트의 문제점**:
    - 데이터베이스 오토 인크리먼트(`@GeneratedValue(strategy = GenerationType.IDENTITY)`)는 각 엔티티에 대해 개별 `INSERT` 문을 실행합니다. 이는 트랜잭션당 여러 SQL 호출을 유발하여 대량 데이터 처리 시 성능 병목을 초래합니다.
    - 특히, JDBC 드라이버와 데이터베이스 간 왕복 시간(round-trip time)이 증가하며, 배치 작업에서 비효율적입니다.
- **대안 ID 생성 전략**:
    - **UUID**: 애플리케이션에서 UUID를 생성하여 사용(`@GeneratedValue(strategy = GenerationType.UUID)`)하면 DB 의존성을 줄이고 병렬 처리가 가능합니다. 단, UUID는 문자열 기반이므로 인덱스 크기가 커질 수 있습니다.
    - **시퀀스 기반 ID**: `@GeneratedValue(strategy = GenerationType.SEQUENCE)`와 함께 `allocationSize`를 설정하여 ID를 미리 할당받습니다. 예: `allocationSize=50`은 50개의 ID를 메모리에 캐싱하여 DB 호출을 줄입니다.
    - **애플리케이션 수준 ID 생성**: 고유 ID 생성 로직을 애플리케이션에서 직접 관리하여 DB 의존성을 완전히 제거. 예: 고유 키 생성 라이브러리 또는 타임스탬프 기반 ID 사용.
- **대규모 배치 처리**:
    - **영속성 컨텍스트 오버헤드**: JPA의 영속성 컨텍스트는 엔티티 상태를 추적하므로 대량 데이터 처리 시 메모리 사용량과 성능 저하를 유발합니다. 예: 수십만 개의 엔티티를 한 트랜잭션에서 관리하면 `OutOfMemoryError` 위험이 있습니다.
    - **비영속 처리**: 영속화가 필요 없는 경우, **JPA 네이티브 쿼리**(`entityManager.createNativeQuery`) 또는 **SQL 매퍼**(예: MyBatis, jOOQ)를 사용하여 직접 SQL을 실행합니다. 이는 영속성 컨텍스트를 우회하여 메모리 사용량과 성능을 최적화합니다.
    - **배치 최적화**: JPA를 사용할 경우, `hibernate.jdbc.batch_size`를 설정(예: 50)하여 배치 `INSERT`/`UPDATE`를 활성화하고, `hibernate.order_inserts=true` 및 `hibernate.order_updates=true`로 SQL 실행 순서를 최적화합니다.
- **실무 예시**: 대량 데이터 마이그레이션 시, JPA의 `persist` 대신 네이티브 `INSERT` 쿼리를 사용하여 처리 속도를 10배 이상 향상시킬 수 있습니다. 예: 100만 건 데이터 삽입 시, 배치 크기를 100으로 설정하면 단일 트랜잭션 내에서 SQL 호출이 크게 감소합니다.

### **4.2 권장사항**

- **오토 인크리먼트 지양**: 고속 처리 시스템에서는 오토 인크리먼트를 피하고 시퀀스 또는 UUID를 선호.
- **배치 처리 최적화**: 대규모 데이터 작업 시 영속성 컨텍스트를 최소화하고, 배치 크기와 트랜잭션 단위를 적절히 설정(예: 1000건 단위로 커밋).
- **모니터링**: Hypersistence Optimizer 같은 도구를 사용하여 ID 생성 전략의 성능을 분석하고 최적화.
- **테스트**: 배치 작업 전, 소규모 데이터로 네이티브 쿼리와 JPA 배치 처리의 성능을 비교 테스트하여 최적 전략 선택.

## **5. 관계 (Relationships)**

### **5.1 OneToMany**

- **@OrderColumn 사용**:
    - `@OrderColumn`은 `OneToMany` 관계에서 컬렉션의 순서를 데이터베이스에 저장하는 데 사용됩니다. 예: `@OrderColumn(name = "order_idx")`는 컬렉션의 인덱스를 별도 열에 저장.
    - 단점: 순서 유지로 인해 추가 `UPDATE` 쿼리가 발생하며, 데이터베이스 정렬은 CPU와 I/O 비용을 증가시킬 수 있습니다.
- **정렬 대안**:
    - **프레젠테이션 계층**: 소규모 데이터(예: 100건 이하)의 경우, UI 또는 API 응답에서 클라이언트 측 정렬(예: Java의 `Collections.sort`)을 수행하여 DB 부하 감소.
    - **비즈니스 계층**: 애플리케이션 또는 도메인 로직에서 정렬(예: `List.sort` 또는 Stream API 사용)을 처리. 데이터 크기가 크지 않다면(예: 1000건 이하) 성능 영향 미미.
    - **쿼리 기반 정렬**: 필요한 경우 JPQL 또는 Criteria API에서 `ORDER BY`를 사용하여 정렬. 예: `SELECT o FROM Order o JOIN o.items i ORDER BY i.createdAt`.
- **실무 팁**: `@OrderColumn`은 순서가 비즈니스 요구사항에 필수적인 경우에만 사용하고, 그렇지 않으면 애플리케이션 계층에서 정렬을 처리하여 DB 오버헤드를 줄입니다.

### **5.2 OneToOne**

- **N+1 문제**:
    - `OneToOne` 관계는 기본적으로 즉시 로딩(`FetchType.EAGER`)으로 설정되어 있어, 연관 엔티티 조회 시 추가 쿼리가 발생(N+1 문제). 예: 100개의 엔티티를 조회하면 101개의 쿼리가 실행될 수 있습니다.
    - **지연 로딩 설정**: `@OneToOne(fetch = FetchType.LAZY)`를 명시하고, `hibernate.enable_lazy_load_no_trans=false`를 설정하여 예기치 않은 프록시 초기화 방지.
    - **바이트코드 향상 없이 지연 로딩**: Hibernate의 바이트코드 향상(예: `@LazyToOne(LazyToOneOption.NO_PROXY)`)을 사용하지 않고, 명시적 JPQL 쿼리(예: `SELECT e FROM Entity e LEFT JOIN FETCH e.related`)로 필요한 데이터만 로드.
    - **대안 모델링**: `OneToOne`을 `OneToMany`로 선언하고, 컬렉션 크기를 1로 제한. 예: `List<RelatedEntity>`를 사용하고 `getFirstRelated()` 메서드로 첫 번째 요소만 반환.
- **컬렉션 접근 제한**:
    - 엔티티에서 컬렉션(`List`, `Set`)에 대한 직접 접근을 제한하고, 단일 요소 접근을 위한 메서드 제공. 예:

        ```java
        public class ParentEntity {
            @OneToMany
            private List<RelatedEntity> related = new ArrayList<>();

            public RelatedEntity getRelated() {
                return related.isEmpty() ? null : related.get(0);
            }
        }

        ```

    - 이 접근법은 `OneToOne`의 단순성을 유지하면서 `OneToMany`의 유연성을 활용합니다.
- **실무 예시**: 사용자와 프로필 간 `OneToOne` 관계에서, 지연 로딩과 `LEFT JOIN FETCH`를 사용하여 N+1 문제를 해결하면 쿼리 수가 100에서 1로 감소할 수 있습니다.

### **5.3 ManyToMany**

- **명시적 관계 엔티티**:
    - `@ManyToMany`는 조인 테이블을 자동 생성하지만, 복잡한 쿼리와 성능 저하를 유발할 수 있습니다. 대신, 중간 관계 엔티티를 명시적으로 정의
    - **이점**:
        - **성능**: 조인 테이블의 복잡성을 줄이고, 명시적 쿼리로 최적화 가능.
        - **감사(Audit)**: 생성/수정 시간, 상태 등 추가 메타데이터 저장 가능.
        - **확장성**: 관계에 새로운 속성(예: 권한 수준, 만료일) 추가 용이.
- **실무 팁**: `@ManyToMany`는 간단한 관계에 적합하지만, 실무에서는 감사 로그나 추가 속성이 필요한 경우가 많으므로 관계 엔티티를 기본으로 고려. 예: 사용자-역할 관계에서 `assignedAt` 필드로 역할 부여 시점을 추적.

### **5.4 권장사항**

- **지연 로딩 기본 사용**: `OneToOne`과 `OneToMany`는 `FetchType.LAZY`로 설정하여 불필요한 데이터 조회 방지.
- **명시적 관계 엔티티**: `ManyToMany`는 관계 엔티티로 관리하여 성능과 유연성 확보.
- **성능 모니터링**: Hypersistence Optimizer를 사용하여 관계 매핑의 비효율성을 진단하고, 쿼리 실행 계획을 분석(예: `EXPLAIN` 사용).
- **테스트**: 단위 테스트와 통합 테스트로 관계 설정과 쿼리 성능을 검증. 예: Testcontainers를 사용한 H2 DB 테스트로 N+1 문제 재현 및 해결.

[세계 자바 챔피언, Vlad Mihalcea 강의 로드맵 로드맵 - 인프런](https://www.inflearn.com/roadmaps/9183)
