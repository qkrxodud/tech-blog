---
title: "엔티티 매핑"
tags: ["JPA", "엔티티 매핑", "@Entity", "기본 키 매핑", "DDL 자동 생성"]
summary: "@Entity, @Table, @Column 등 엔티티와 테이블을 매핑하는 어노테이션과 IDENTITY·SEQUENCE·TABLE 기본 키 생성 전략을 정리합니다."
---

## 엔티티 매핑 소개

- @Entity, @Table : 객체와 테이블 매핑
- @Column : 필드와 컬럼 매핑
- @Id : 기본 키 매핑
- @ManyToOne, @JoinColumn : 연관관계 매핑

## 객체와 테이블 매핑

**@Entity**

- @Entity가 붙은 클래스는 JPA가 관리합니다.
- JPA를 사용해서 테이블과 매핑할 클래스는 @Entity가 필수입니다.
- 주의
    - 기본 생성자 필수
    - final 클래스, enum, interface, inner 클래스는 사용하지 못합니다.
    - 저장할 필드에 final을 사용할 수 없습니다.
- @Entity의 name 속성
    - JPA에서 사용할 엔티티 이름을 지정합니다.
    - 기본값은 클래스명과 동일한 값을 사용합니다.
    - 같은 클래스 이름이 없으면 가급적 기본값을 사용합니다.

**@Table**

- @Table은 엔티티와 매핑할 테이블을 지정합니다.
- @Table 속성
    - name : 매핑할 테이블 이름, 기본값은 엔티티 이름을 사용
    - catalog : 데이터베이스 catalog 매핑
    - schema : 데이터베이스 schema 매핑
    - uniqueConstraints : DDL 생성 시에 유니크 제약 조건 생성

```kotlin
package helloJpa;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "MBR")
public class Member {

    ...
}
```

## 데이터베이스 스키마 자동 생성

- DDL을 애플리케이션 실행 시점에 자동 생성합니다.
- 테이블 중심에서 객체 중심으로 접근합니다.
- 데이터베이스 방언을 활용해서 데이터베이스에 맞는 적절한 DDL을 생성합니다.
- 이렇게 생성된 DDL은 개발 장비에서만 사용합니다.
- 생성된 DDL은 운영 서버에서 사용하지 않거나, 적절히 다듬은 후 사용합니다.

persistence.xml에 해당 옵션을 추가합니다.

```java
<property name="hibernate.hbm2ddl.auto" value="create"/>
```

앱을 실행하면 자동으로 DDL이 완성되는 로그를 확인할 수 있습니다.

## 데이터베이스 스키마 자동 생성 - 속성

hibernate.hbm2ddl.auto 옵션

- create : 기존 테이블 삭제 후 다시 생성(DROP + CREATE)
- create-drop : create와 같으나 종료 시점에 테이블 DROP
- update : 변경분만 반영(운영 DB에는 사용하면 안 됨)
- validate : 엔티티와 테이블이 정상 매핑되었는지만 확인
- none : 사용하지 않음

데이터베이스 방언마다 달라집니다.

예를 들어 persistence.xml의 데이터베이스를 H2에서 Oracle로 변경하면

```java
<!--<property name="hibernate.dialect" value="org.hibernate.dialect.H2Dialect"/>-->
<property name="hibernate.dialect" value="org.hibernate.dialect.Oracle12cDialect"/>
```

Oracle에 맞게 varchar2로 변경되는 것을 볼 수 있습니다.

## 데이터베이스 스키마 자동 생성 - 주의

- **운영 장비에는 절대 create, create-drop, update를 사용하면 안 됩니다.**
- 개발 초기 단계는 create 또는 update
- 테스트 서버는 update 또는 validate
- 스테이징과 운영 서버는 validate 또는 none

사실 테스트 서버에서도 사용하지 않는 것을 권장합니다.

## DDL 생성 기능

- 제약조건 추가 : 회원 이름 필수, 10자를 초과하면 안 됩니다.
    - @Column(nullable = false, length = 10)
- 유니크 제약조건 추가
    - @Table(uniqueConstraints = {@UniqueConstraint(name = "NAME_AGE_UNIQUE", columnNames = {"NAME", "AGE"})})
- DDL 생성 기능은 DDL을 자동 생성할 때만 사용되고 JPA의 실행 로직에는 영향을 주지 않습니다.

## 필드와 컬럼 매핑

**요구사항 추가**

- 회원은 일반 회원과 관리자로 구분해야 합니다.
- 회원 가입일과 수정일이 있어야 합니다.
- 회원을 설명할 수 있는 필드가 있어야 합니다. 이 필드는 길이 제한이 없습니다.

## 매핑 어노테이션 정리

- @Column : 컬럼 매핑
- @Temporal : 날짜 타입 매핑
- @Enumerated : enum 타입 매핑
- @Lob : BLOB, CLOB 매핑
- @Transient : DB와 상관없이 메모리에서 사용

**@Enumerated 매핑**

자바 Enum 타입을 매핑할 때 사용합니다.

**주의! ORDINAL을 사용하면 안 됩니다. 추가 요청사항으로 GUEST를 추가할 때 누군가가 순서를 앞에 등록하게 되면 DB 데이터가 꼬이게 될 수 있습니다.**

**그냥 STRING으로 지정해서 사용하면 됩니다.**

**@Temporal 매핑**

날짜 타입(java.util.Date, java.util.Calendar)을 매핑할 때 사용합니다.

참고: LocalDate, LocalDateTime을 사용할 때는 생략 가능합니다(최신 하이버네이트 지원).

**@Lob**

데이터베이스 BLOB, CLOB 타입과 매핑합니다.

- @Lob에는 지정할 수 있는 속성이 없습니다.
- 매핑하는 필드 타입이 문자면 CLOB 매핑, 나머지는 BLOB 매핑
    - CLOB : String, char[], java.sql.CLOB
    - BLOB : byte[], java.sql.BLOB

**@Transient**

- 필드를 매핑하지 않습니다.
- 데이터베이스에 저장, 조회하지 않습니다.
- 주로 메모리상에서만 임시로 어떤 값을 보관하고 싶을 때 사용합니다.
- @Transient : private Integer temp;

## 기본 키 매핑 방법

- 직접 할당 : @Id만 사용
- 자동 생성 : @GeneratedValue
    - IDENTITY : 데이터베이스에 위임, MySQL
    - SEQUENCE : 데이터베이스 시퀀스 오브젝트 사용, Oracle
        - @SequenceGenerator 필요
    - TABLE : 키 생성용 테이블 사용, 모든 DB에서 사용
        - @TableGenerator 필요
    - AUTO : 방언에 따라 자동 지정, 기본값

**1) IDENTITY 전략 - 특징**

- 기본 키 생성을 데이터베이스에 위임합니다.
- 주로 MySQL, PostgreSQL, SQL Server, DB2에 사용합니다.
- JPA는 보통 트랜잭션 커밋 시점에 INSERT SQL을 실행합니다.
- AUTO_INCREMENT는 데이터베이스에 INSERT SQL을 실행하고 DB에서 식별자를 조회합니다.
- IDENTITY 전략은 em.persist() 시점에 즉시 INSERT SQL을 실행하고 DB에서 식별자를 조회합니다.

부연 설명

- em.persist는 1차 캐시에 저장하고 쓰기 지연 SQL에 저장한 후 commit 시점에 insert를 시작하는데, IDENTITY 전략은 DB에 insert할 시점에 PK를 주기 때문에 괴리가 발생합니다.
- 이를 해결하기 위해 JPA는 IDENTITY 전략을 사용할 때 em.persist를 하는 즉시 DB에 INSERT 문을 전달합니다.

**1-1) IDENTITY - 매핑**

```java
@Entity
public class Member {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
```

**2) SEQUENCE 전략**

- 데이터베이스 시퀀스는 유일한 값을 순서대로 생성하는 특별한 데이터베이스 오브젝트입니다.
- Oracle, PostgreSQL, DB2, H2 데이터베이스에서 사용합니다.
- PK는 Long을 권장합니다.

**2-1) SEQUENCE - 매핑**

```java
@Entity
@SequenceGenerator(
        name = "MEMBER_SEQ_GENERATOR",
        sequenceName = "MEMBER_SEQ",
        initialValue = 1, allocationSize = 1
)
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "MEMBER_SEQ_GENERATOR")
    private Long id;
```

**2-2) SEQUENCE - @SequenceGenerator**

- 주의 : allocationSize 기본값 = 50

**3) TABLE 전략**

- 키 생성 전용 테이블을 하나 만들어서 데이터베이스 시퀀스를 흉내 내는 전략입니다.
- 장점 : 모든 데이터베이스에 적용 가능
- 단점 : 성능이 좋지 않음

**3-1) TABLE - 매핑**

```less
@Entity
@TableGenerator(
        name = "MEMBER_SEQ_GENERATOR",
        table = "MY_SEQUENCES",
        pkColumnName = "MEMBER_SEQ", allocationSize = 1
)
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.TABLE, generator = "MEMBER_SEQ_GENERATOR")
```

**3-2) TABLE - @TableGenerator**

- DB에서 보통 관례로 사용하는 것이 있기 때문에 운영에서는 보통 TABLE 전략을 사용하지 않습니다.

## 권장하는 식별자 전략

- 기본 키 제약 조건 : null이 아님, 유일함, 변하지 않아야 함
- 미래까지 이 조건을 만족하는 자연 키는 찾기 어렵습니다(자연 키의 예: 주민등록번호처럼 유일한 값). 대리 키(대체 키)를 사용합시다.
- 예를 들어 주민등록번호도 기본 키로 적절하지 않습니다. 회원 테이블의 PK를 주민등록번호로 저장했는데, 나라에서 주민등록번호를 저장하면 안 된다는 정책이 나왔다고 합시다. 이때 회원 테이블을 참조하는 나머지 테이블이 PK를 통해 Join을 사용하고 있다면, 전부 수정하는 데 많은 노동력과 자원이 발생합니다.
- **권장 : Long형 + 대체 키 + 키 생성 전략 사용**

## SEQUENCE 전략과 최적화

**그렇다면 SEQUENCE 전략과 TABLE 전략은 PK를 얻기 위해서 계속 insert로 DB에 접속한 후 PK 값을 받아오는 것일까요? 최적화 전략을 사용하면 이를 줄일 수 있습니다.**

```java
@SequenceGenerator(
        name = "MEMBER_SEQ_GENERATOR",
        sequenceName = "MEMBER_SEQ",
        initialValue = 1, allocationSize = 1
```

- Generator를 보면 initialValue = 1, allocationSize = 50으로 변경하면, 시퀀스 값을 1부터 50까지 사용하겠다고 DB에 전달한 후 해당 값을 애플리케이션이 가지고 있다가 자동으로 em.persist()를 할 때 PK를 부여받게 됩니다. 예시를 보겠습니다.

```java
package helloJpa;

import javax.persistence.EntityManager;
import javax.persistence.EntityManagerFactory;
import javax.persistence.EntityTransaction;
import javax.persistence.Persistence;
import java.util.List;

public class JpaMain {

    public static void main(String[] args) {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("hello");// 애플리케이션 에서 한개만 만들어 져야된다.

        EntityManager em = emf.createEntityManager();//하나의 단위를 만들때마다 만들어 줘야된다.

        EntityTransaction tx = em.getTransaction();
        tx.begin();

        try {
            System.out.println("================");
            Member memberA = new Member();
            memberA.setName("memberA");
            em.persist(memberA);
            System.out.println("MemberA : " + memberA.getId());

            Member memberB = new Member();
            memberB.setName("memberB");
            em.persist(memberB);
            System.out.println("memberB : " + memberB.getId());

            Member memberC = new Member();
            memberC.setName("memberC");
            em.persist(memberC);
            System.out.println("memberC : " + memberC.getId());

            Member memberD = new Member();
            memberD.setName("memberD");
            em.persist(memberD);
            System.out.println("memberD : " + memberD.getId());
            System.out.println("================");

            tx.commit();
        } catch (Exception e) {
            tx.rollback();
        } finally {
            em.close();
        }
        emf.close();
    }
}
```

로그

1) PK 값을 가져오는 것을 확인할 수 있습니다.

2) 이후 쓰기 지연 SQL을 통해서 commit 시점에 insert를 한 번에 동작시킵니다.

> 이 글은 인프런 김영한 님의 [자바 ORM 표준 JPA 프로그래밍 — 기본편](https://www.inflearn.com/course/ORM-JPA-Basic)을 들으며 정리한 노트입니다.
