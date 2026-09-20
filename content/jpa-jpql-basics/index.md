---
title: "JPQL 기본 문법"
tags: ["JPA", "JPQL", "프로젝션", "페이징", "서브쿼리"]
summary: "JPQL의 기본 문법과 TypedQuery, 파라미터 바인딩, 프로젝션, 페이징, 조인, 서브쿼리, CASE 식 등 자주 쓰는 문법을 정리합니다."
---

## JPQL 소개

- JPQL은 객체지향 쿼리 언어입니다. 따라서 테이블을 대상으로 쿼리하는 것이 아니라 엔티티 객체를 대상으로 쿼리합니다.
- JPQL은 SQL을 추상화해서 특정 데이터베이스 SQL에 의존하지 않습니다.
- JPQL은 결국 SQL로 변환됩니다.

## JPQL 문법

- select m from Member as m where m.age > 18
- 엔티티와 속성은 대소문자를 구분해야 합니다(Member, age).
- JPQL 키워드는 대소문자를 구분할 필요가 없습니다(SELECT, FROM, where).
- 엔티티 이름을 사용합니다. 테이블 이름이 아닙니다(Member).
- 별칭은 필수입니다(m). as는 생략할 수 있습니다.

## TypedQuery, Query

- TypedQuery: 반환 타입이 명확할 때 사용합니다.
- Query: 반환 타입이 명확하지 않을 때 사용합니다.

```java
TypedQuery<Member> query1 = em.createQuery("select m from Member m", Member.class);
TypedQuery<String> query2 = em.createQuery("select m.username from Member m", String.class);
Query query3 = em.createQuery("select m.username, m.age from Member m");
```

## 결과 조회 API

- query.getResultList(): 결과가 하나 이상일 때 리스트를 반환합니다.
    - 결과가 없으면 빈 리스트를 반환합니다.
- query.getSingleResult(): 결과가 정확히 하나일 때 단일 객체를 반환합니다.
    - 결과가 없으면 javax.persistence.NoResultException이 발생합니다.
    - 둘 이상이면 javax.persistence.NonUniqueResultException이 발생합니다.

```java
TypedQuery<Member> query1 = em.createQuery("select m from Member m", Member.class);
List<Member> resultList = query1.getResultList();
for (Member member1 : resultList) {
    System.out.println("id >>> " + member1.getUsername());
}

```

```java
TypedQuery<String> query2 = em.createQuery("select m from Member m where m.id = 10", String.class);
Member singleResult = query1.getSingleResult();
System.out.println("id : " + singleResult.getId());
```

## 파라미터 바인딩 - 이름 기준, 위치 기준

```java
Member member = new Member();
member.setUsername("member1");
em.persist(member);

Member memberResult = em.createQuery("select m from Member m where m.username = :username", Member.class)
        .setParameter("username", "member1")
        .getSingleResult();
System.out.println("SingleResult = " + memberResult.getUsername());
```

## 프로젝션

- SELECT 절에 조회할 대상을 지정하는 것입니다.
- 프로젝션 대상: 엔티티, 임베디드 타입, 스칼라 타입(숫자, 문자 등 기본 데이터 타입)
- SELECT m FROM Member m: 엔티티 프로젝션
- SELECT m.team FROM Member m: 엔티티 프로젝션
- SELECT m.address FROM Member m: 임베디드 타입 프로젝션
- SELECT m.username, m.age FROM Member m: 스칼라 타입 프로젝션
- DISTINCT로 중복을 제거할 수 있습니다.

### 프로젝션 - 여러 값 조회

- SELECT m.username, m.age FROM Member m
- 1. Query 타입으로 조회
- 2. Object[] 타입으로 조회
- 3. new 명령어로 조회
    - 단순 값을 DTO로 바로 조회합니다.
    - SELECT new jpabook.jpql.UserDTO(m.username, m.age) FROM Member m
    - 패키지명을 포함한 전체 클래스명을 입력합니다.
    - 순서와 타입이 일치하는 생성자가 필요합니다.

```java
List<MemberDTO> resultList = em.createQuery("select new jpql.MemberDTO(m.username, m.age) from Member m ", MemberDTO.class)
        .getResultList();

MemberDTO memberDTO = resultList.get(0);
System.out.println(memberDTO.getUsername());
System.out.println(memberDTO.getAge());
```

```java
package jpql;

public class MemberDTO {

    private String username;
    private int age;

    public MemberDTO(String username, int age) {
        this.username = username;
        this.age = age;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public int getAge() {
        return age;
    }

    public void setAge(int age) {
        this.age = age;
    }

}

```

## 페이징 API

- JPA는 페이징을 다음 두 API로 추상화합니다.
- setFirstResult(int startPosition): 조회 시작 위치(0부터 시작)
- setMaxResults(int maxResult): 조회할 데이터 수

### 페이징 API 예시

```java
for( int i = 0; i < 100; i++) {
    Member member = new Member();
    member.setUsername("member" + i);
    member.setAge(i);
    em.persist(member);
}

em.flush();
em.clear();

List<Member> resultList = em.createQuery("select m from Member m order by m.age desc", Member.class)
        .setFirstResult(0)
        .setMaxResults(10)
        .getResultList();
System.out.println(resultList.size());
for (Member member1 : resultList) {
    System.out.println("member = " + member1);
}

tx.commit();
```

## 조인

- 내부 조인: SELECT m FROM Member m [INNER] JOIN m.team t
- 외부 조인: SELECT m FROM Member m LEFT [OUTER] JOIN m.team t
- 세타 조인: select count(m) from Member m, Team t where m.username = t.name

### 조인 - ON 절

- ON 절을 활용한 조인입니다(JPA 2.1부터 지원).
    - 1. 조인 대상 필터링
    - 2. 연관관계 없는 엔티티 외부 조인(하이버네이트 5.1부터)

1. 조인 대상 필터링

- 회원과 팀을 조인하면서, 팀 이름이 A인 팀만 조인합니다.

```sql
JPQL : SELECT m
            , t
         FROM Member m
         LEFT JOIN m.team t on t.name = 'A'
```

```sql
SQL : SELECT m.*
           , t.*
        FROM Member m
        LEFT JOIN Team t ON m.TEAM_ID=t.id and t.name = 'A'
```

2. 연관관계 없는 엔티티 외부 조인

- 예) 회원의 이름과 팀의 이름이 같은 대상을 외부 조인합니다.

```sql
JPQL : SELECT m
            , t
         FROM Member m
         LEFT JOIN m.team t on m.username = t.name
```

```sql
SQL : SELECT m.*
           , t.*
        FROM Member m
        LEFT JOIN Team t ON m.username = t.name
```

## 서브 쿼리

- 나이가 평균보다 많은 회원

```sql
JPQL : select m
         from Member m
        where m.age > ( select avg(m2.age)
                          from Member m2 )
```

- 한 건이라도 주문한 고객

```sql
SQL : select m
        from Member m
       where (select count(o)
                from  Order o
               where m = o.member) > 0
```

### 서브 쿼리 지원 함수

- [NOT] EXISTS (subquery): 서브쿼리에 결과가 존재하면 참입니다.
    - {ALL | ANY | SOME} (subquery)
    - ALL: 모두 만족하면 참입니다.
    - ANY, SOME: 같은 의미이며, 조건을 하나라도 만족하면 참입니다.
- [NOT] IN (subquery): 서브쿼리의 결과 중 하나라도 같은 것이 있으면 참입니다.

서브 쿼리 - 예제

- 팀A 소속인 회원

```sql
select m from Member m
 where exists ( select t
                  from m.team t
                 where t.name = '팀')
```

- 전체 상품 각각의 재고보다 주문량이 많은 주문들

```sql
select o
  from Order o
 where o.orderAmout > ALL ( select p.stockAmount
                              from Product p)
```

- 어떤 팀이든 팀에 소속된 회원

```sql
select m from Member m
 where m.team = ANY ( select t
                        from Team t )
```

### JPA 서브 쿼리 한계

- JPA는 WHERE, HAVING 절에서만 서브 쿼리를 사용할 수 있습니다.
- SELECT 절도 가능합니다(하이버네이트에서 지원).
- FROM 절의 서브 쿼리는 현재 JPQL에서 불가능합니다.
    - 조인으로 풀 수 있으면 풀어서 해결합니다.
    - 쿼리를 두 번 날려서 해결합니다.
    - 네이티브 쿼리로 넘겨서 해결합니다.

### JPQL 타입 표현

- 문자: 'HELLO', 'She''s'
- 숫자: 10L(Long), 10D(Double), 10F(Float)
- Boolean: TRUE, FALSE
- ENUM: jpabook.MemberType.Admin

```java
try {
    Team team = new Team();
    team.setName("TeamA");
    em.persist(team);

    Member member = new Member();
    member.setUsername("TeamA");
    member.setType(MemberType.ADMIN);
    member.setAge(10);

    member.setTeam(team);

    em.persist(member);

    em.flush();
    em.clear();

    String query = "select m.username, 'HELLO', true" +
                    " From Member m " +
                    "where m.type = jpql.MemberType.USER";
    List<Object[]> resultList = em.createQuery(query)
            .getResultList();
    System.out.println(resultList.size());

    for (Object[] objects : resultList) {
        System.out.println(objects[0]);
        System.out.println(objects[1]);
        System.out.println(objects[2]);

    }
```

### 조건식 - CASE 식

- 기본 CASE 식

```sql
select
       case when m.age <= 10 then '학생요금'
            when m.age >= 60 then '경로요금'
            else '일반요금'
       end
  from Member m
```

- 단순 CASE 식

```sql
select
       case t.name
            when '팀A' then '인센티브110%'
            when '팀B' then '인센티브120%'
            else '인센티브105%'
       end
  from Team t
```

- COALESCE: 하나씩 조회해서 null이 아니면 반환합니다.
- NULLIF: 두 값이 같으면 null을 반환하고, 다르면 첫 번째 값을 반환합니다.

사용자 이름이 없으면 이름 없는 회원을 반환합니다.

```sql
select
       coalesce(m.username, '이름 없는 회원')
  from Member m
```

사용자 이름이 '관리자'면 null을 반환하고 나머지는 본인의 이름을 반환합니다.

```sql
select
       NULLIF(m.username, '관리자')
  from Member m
```

JPQL 기본 함수

- CONCAT
- SUBSTRING
- TRIM
- LOWER, UPPER
- LENGTH
- LOCATE
- ABS, SQRT, MOD
- SIZE, INDEX (JPA 용도)

사용자 정의 함수 호출

- 하이버네이트 사용 전 방언에 추가해야 합니다.
    - 사용하는 DB 방언을 상속받고, 사용자 정의 함수를 등록합니다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<persistence version="2.2"
             xmlns="http://xmlns.jcp.org/xml/ns/persistence" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/persistence http://xmlns.jcp.org/xml/ns/persistence/persistence_2_2.xsd">
    <persistence-unit name="hello">
        <properties>
<!-- 필수 속성 --><property name="javax.persistence.jdbc.driver" value="org.h2.Driver"/>
            <property name="javax.persistence.jdbc.user" value="sa"/>
            <property name="javax.persistence.jdbc.password" value=""/>
            <property name="javax.persistence.jdbc.url" value="jdbc:h2:tcp://localhost/~/test"/>
            <property name="hibernate.dialect" value="dialect.MyH2Dialect"/>
```

```java
package dialect;

import org.hibernate.dialect.H2Dialect;
import org.hibernate.dialect.function.StandardSQLFunction;
import org.hibernate.type.StandardBasicTypes;

public class MyH2Dialect  extends H2Dialect {
    public MyH2Dialect() {
        registerFunction("group_concat", new StandardSQLFunction("group_concat", StandardBasicTypes.STRING));
    }
}

```

```java
String query = "select function('group_concat', m.username) FROM Member m";
List<String> resultList = em.createQuery(query, String.class)
        .getResultList();
```

> 이 글은 인프런 김영한 님의 [자바 ORM 표준 JPA 프로그래밍 — 기본편](https://www.inflearn.com/course/ORM-JPA-Basic)을 들으며 정리한 노트입니다.
