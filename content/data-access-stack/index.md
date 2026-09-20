---
title: "데이터 액세스 스택"
tags: ["JPA", "Hibernate", "P6Spy", "Flyway", "커넥션풀"]
summary: "JPA·Hibernate 기반 데이터 액세스 계층에서 SQL 로깅, 스키마 관리, 커넥션 풀 모니터링 등 성능을 좌우하는 요소들을 정리합니다."
---

## 1. 데이터 액세스 스택 (Data Access Stack)

### 1.1 성능 측정 단위

- **응답 시간 (Latency)**: 트랜잭션 매니저 수준에서 측정.
- **트랜잭션 응답 시간 구성**:
    1. DB 연결 획득 시간
    2. Statement가 DB 엔진에 제출되는 시간
    3. Statement 실행 시간
    4. 결과 집합을 가져오는 시간
    5. 트랜잭션 종료 및 DB 연결 해제 전 애플리케이션 유휴 시간
- **처리량 (Throughput)**:
    - 확장성의 측정 단위.
    - 단위 시간당 실행된 트랜잭션 수.
    - **처리량 분수의 역수 = 평균 응답 시간**.
    - 응답 시간 감소 → 성능 및 확장성 향상.

### 1.2 설계 고려사항

- **성능 고려 설계**: 데이터 처리와 관련된 모든 계층 이해 필요.
- **객체-관계 불일치 (Object-Relational Impedance Mismatch)**:
    - 객체 지향 도메인 모델과 관계형 DB 간 불일치.
    - 데이터 액세스 계층에서 변환 책임.
- **JPA 명세**:
    - JPA는 명세일 뿐, 성능은 구현 세부 사항에 의존.
    - JPQL은 데이터 조회용, 네이티브 SQL 대체 아님.

---

## 2. SQL Statement 로깅 (Logging SQL Statement)

### 2.1 필요성

- **JPA/Hibernate**:
    - persist, merge, remove 등 엔티티 상태 변화에 따라 SQL 자동 생성.
    - 로깅 없이는 생성된 SQL 확인 불가 → 성능 문제 발생 가능.
- **일반 JDBC**: 전송되는 Statement 완전 제어 가능.

### 2.2 Hibernate 로그 설정

- **설정 옵션**:
    - show_sql: 사용 권장하지 않음 (로깅 프레임워크 사용 권장).
    - format_sql: SQL을 여러 줄로 출력. 외부 로깅 프레임워크 사용 시 동작 안 함.
    - use_sql_comments:
        - 엔티티 상태 전환, 조인 이유, 명시적 잠금 메커니즘 등 주석 추가.
        - 주석은 JDBC 드라이버로 전송 → 네트워크 I/O 오버헤드 발생.
- **JBoss Logging**:
    - Hibernate 내부 로깅 프레임워크.
    - 외부 로깅 프레임워크와 연결 역할.
- **Prepared Statement 바인드 파라미터 로깅**:
    - Hibernate SQL 타입 디스크립터에 새로운 Appender 추가 필요.

### 2.3 P6Spy

- **역할**:
    - 외부 JDBC Statement 프록시.
    - JDBC 드라이버 또는 DataSource 프록싱.
    - Statement 실행 가로채기, 바인드 파라미터 값 로깅.
- **기능**:
    - 장시간 실행 Statement 감지.
    - 실행 Statement 수 검증.
    - 횡단 관심사 (Cross-Cutting Concerns) 제공.
- **사용법**:
    - P6Spy 설정을 통해 정확한 SQL 쿼리 확인.
    - 설정 예: JDBC URL에 p6spy 추가, spy.properties 파일 구성.

---

## 3. 스키마 관리 (Schema Management)

### 3.1 스키마 변경 원칙

- **데이터베이스 주도**: 스키마 변경은 DB가 주도해야 함.
- **권장사항**:
    1. 스키마 마이그레이션 **수동 실행 금지**.
    2. 운영 환경에서 Hibernate HBM2DDL auto 사용 금지.
    3. HBM2DDL:
        - DB 스키마 프로토타입 또는 초기 스크립트 생성용.
        - 프로덕션 환경 사용 부적합.

### 3.2 Flyway

- **역할**: DDL 형상 관리 및 자동 적용.
- **장점**:
    - 애플리케이션에서 자동 스키마 적용 편리.
    - 자동화 툴과 통합 시 이점 큼.
- **주의점**:
    - 실서버/베타서버에서 설정 위험.
    - 신중한 테스트 및 롤백 전략 필요.

---

## 4. 통합 테스트 (Integration Test)

- **도커와 TempFS 활용**:
    - 인메모리 DB 테스트로 속도 향상.
    - 예: H2, Testcontainers 활용.

---

## 5. 연결 관리 및 제공자 (Connection Management / Connection Provider)

### 5.1 연결 풀 사용

- **중요성**: 특정 임계값 초과 시 연결 수 증가가 성능 악화 초래.
- **권장**: Connection Pool 사용.

### 5.2 Hibernate 연결 제공자

- **DriverManagerConnectionProvider**: 테스트용.
- **C3P0ConnectionProvider**: 안정적.
- **HikariConnectionProvider**: 빠름, Hibernate 전용 속성 미지원.
- **DatasourceConnectionProvider**: 가장 유연.

### 5.3 Hibernate 연결 생명주기

- **리소스 로컬 트랜잭션**: 트랜잭션 종료 시 연결 해제.
- **JTA**: 각 Statement 실행 후 연결 해제.
- **연결 획득 지연**:
    - 연결 획득 시간 지연 → 더 많은 연결 가능.

---

## 6. 연결 모니터링 (Connection Monitoring)

### 6.1 풀 크기 중요성

- **공식**: PDF 참고 (변칙적 상황 미고려).
- **실용적 접근**:
    1. 연결 사용량 모니터링:
        - 연결 획득 시간 및 유지 시간 분석.
    2. 풀 크기 자동화:
        - 연결 획득 타임아웃 감지 시 풀 크기 자동 조정.

### 6.2 FlexyPool

- **역할**:
    - DB Connection Pool 동적 관리.
    - 로깅 지원 → 적절한 풀 크기 설정 가능.
- **설정**:
    - FlexyPool 구성으로 동적 풀 크기 조정 및 모니터링.

---

## 7. Hibernate 통계 (Hibernate Statistic)

- **설명**: Hibernate 내부 통계 수집으로 성능 병목 지점 파악.
- **활용**: 쿼리 실행 시간, 캐시 히트율, 연결 사용량 분석.

---

## 8. JPA 및 Hibernate 타입 (JPA and Hibernate Types)

### 8.1 Enum vs String

- **Ordinal**: Enum 값을 숫자로 저장.
- **String**: Enum 값을 문자열로 저장.
- **개인 의견**:
    - Enum 조인 불필요.
    - String 사용이 더 안전하고 간단.

---

## 9. 추가 참고사항

- **고성능 JPA & Hibernate** 강의는 성능 최적화에 초점.
- **권장 자료**:
    - 강의 PDF 및 예제 코드.
    - Hibernate 공식 문서.
    - P6Spy, Flyway, FlexyPool 문서.

---

## 10. 사용자 메모

- **P6Spy**: 정확한 쿼리 확인 도구.
- **Flyway**: DDL 형상 관리, 자동화 툴 통합 시 이점 있으나 운영 환경 설정 주의.
- **FlexyPool**: 동적 Connection Pool 관리 및 로깅.
- **Enum vs String**: String 선호 (간단하고 안전).

[세계 자바 챔피언, Vlad Mihalcea 강의 로드맵 - 인프런](https://www.inflearn.com/roadmaps/9183)
