---
title: "상속 매핑 전략"
tags: ["JPA","상속매핑","Inheritance","MappedSuperclass","Hibernate"]
summary: "JPA의 상속 매핑 전략인 SINGLE_TABLE, JOINED, TABLE_PER_CLASS, MappedSuperclass를 비교하고 실무 선택 기준과 성능 최적화 팁을 정리합니다."
---

JPA의 상속 매핑은 객체지향의 계층 구조를 관계형 데이터베이스에 매핑하는 방법을 제공합니다. 각 전략은 성능, 데이터 무결성, 유지보수성 측면에서 장단점이 있으며, 적절한 선택이 성능에 큰 영향을 미칩니다.

- **단일 테이블 전략 (**SINGLE_TABLE**)**:
    - **설명**: 모든 상위 및 하위 클래스 엔티티를 단일 테이블에 저장. 클래스 구분을 위해 판별자 컬럼(@DiscriminatorColumn, 기본값 DTYPE) 사용.
    - **장점**:
        - 단일 테이블로 쿼리 성능이 빠릅니다(조인 불필요).
        - 간단한 계층 구조에 적합.
    - **단점**:
        - 하위 클래스별 고유 속성은 NULL 허용 컬럼으로 저장, 데이터 무결성 제약(NOT NULL) 사용 불가.
        - 테이블 크기가 커질수록 관리 복잡성 증가.
    - **실무 예시**: 소규모 상속 계층(예: Notification → EmailNotification, SmsNotification)에서 사용. 예:

        ```java
        @Entity
        @Inheritance(strategy = InheritanceType.SINGLE_TABLE)
        @DiscriminatorColumn(name = "notification_type")
        public abstract class Notification {
            @Id @GeneratedValue
            private Long id;
            private String firstName;
            private String lastName;
        }

        @Entity
        @DiscriminatorValue("EMAIL")
        public class EmailNotification extends Notification {
            private String emailAddress;
        }
        ```


    - **성능 고려사항**: 쿼리 성능은 우수하나, 테이블 크기가 커지면 인덱스 효율성 저하 가능.
- **조인 전략 (**JOINED**)**:
    - **설명**: 상위 클래스와 각 하위 클래스마다 별도 테이블 생성, 조인으로 데이터 결합. @Inheritance(strategy = InheritanceType.JOINED) 사용.
    - **장점**:
        - 데이터 정규화로 무결성 유지(NOT NULL 제약 가능).
        - @ManyToOne 다형성 쿼리에 적합.
    - **단점**:
        - 조회 시 조인 쿼리로 성능 저하 가능.
        - 다형성 쿼리(예: SELECT n FROM Notification n)는 복잡한 조인 발생.
    - **실무 예시**: 데이터 무결성이 중요한 경우(예: Publication → Book, BlogPost) 사용.

        ```java
        @Entity
        @Inheritance(strategy = InheritanceType.JOINED)
        public abstract class Publication {
            @Id @GeneratedValue
            private Long id;
            private String title;
            private LocalDate publishingDate;
        }

        @Entity
        public class Book extends Publication {
            private int pages;
        }

        ```

    - **성능 고려사항**: @ManyToOne 관계에서 Strategy 패턴과 결합하면 다형성 처리 효율적. 그러나 조인 쿼리 최적화(예: 인덱스, JOIN FETCH) 필요.
- **구체 클래스당 테이블 전략 (**TABLE_PER_CLASS**)**:
    - **설명**: 각 구체 클래스마다 독립된 테이블 생성. @Inheritance(strategy = InheritanceType.TABLE_PER_CLASS) 사용.
    - **장점**: 테이블 구조 단순, 정규화 불필요.
    - **단점**:
        - 다형성 쿼리 시 모든 테이블에 대해 UNION 쿼리 발생, 성능 저하.
        - 중복된 속성 매핑으로 유지보수 복잡.
    - **실무 예시**: 드물게 사용. 다형성 쿼리가 필요 없는 경우 제한적으로 고려.
    - **성능 고려사항**: UNION 쿼리로 인해 대규모 데이터 처리 시 비효율적, 사용 지양 권장.
- **매핑된 슈퍼클래스 (**@MappedSuperclass**)**:
    - **설명**: 상속 계층이 아닌 공통 속성 재사용을 위해 사용. 데이터베이스 테이블에 직접 매핑되지 않음.
    - **장점**: 공통 속성(예: 생성일, 수정일)을 여러 엔티티에서 재사용 가능.
    - **단점**: 다형성 쿼리 지원 불가.
    - **실무 예시**: 감사 로그 속성 공유 시 사용. 예:

        ```java
        @MappedSuperclass
        public abstract class Auditable {
            private LocalDateTime createdAt;
            private LocalDateTime updatedAt;
        }

        @Entity
        public class Post extends Auditable {
            @Id @GeneratedValue
            private Long id;
            private String title;
        }
        ```

    - **성능 고려사항**: 다형성 필요 없는 경우 간단하고 효율적.

### **6.2 실무 적용**

- **전략 선택 기준**:
    - **데이터 접근 패턴**: 조회 빈도가 높으면 SINGLE_TABLE, 무결성 우선이면 JOINED.
    - **성능 요구사항**: 다형성 쿼리가 많으면 JOINED 또는 SINGLE_TABLE 선호.
    - **유지보수성**: 복잡한 계층 구조는 JOINED로 정규화.
- **성능 최적화**:
    - 다형성 쿼리 최적화: JOIN FETCH 또는 @NamedEntityGraph로 N+1 문제 방지.
    - 판별자 컬럼 인덱싱: SINGLE_TABLE에서 DTYPE 컬럼에 인덱스 추가.
    - Hypersistence Optimizer로 상속 매핑 문제(예: 비효율적 조인) 진단.
- **실무 팁**:
    - 상속은 주로 행동 패턴(Strategy, Visitor) 구현에 적합. 데이터 구조 재사용은 컴포지션 선호.
    - SINGLE_TABLE은 소규모 계층, JOINED는 복잡한 계층에 적합. TABLE_PER_CLASS는 피하는 것이 좋습니다.

### **6.3 권장사항**

- 상속 계층은 최소화하여 쿼리 복잡성 감소.
- SINGLE_TABLE은 간단한 계층, JOINED는 무결성 우선 시스템에 사용.
- 다형성 쿼리 최적화를 위해 @NamedEntityGraph 또는 JOIN FETCH 활용.
- Hypersistence Optimizer로 상속 매핑의 성능 문제 분석.

[세계 자바 챔피언, Vlad Mihalcea 강의 로드맵 로드맵 - 인프런](https://www.inflearn.com/roadmaps/9183)
