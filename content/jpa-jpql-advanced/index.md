---
title: "JPQL 경로 표현식과 페치 조인"
tags: ["JPA", "JPQL", "페치 조인", "경로 표현식", "N+1"]
summary: "JPQL 경로 표현식에서 명시적 조인과 묵시적 조인의 차이를 정리하고, 페치 조인의 동작 방식과 페이징·DISTINCT 관련 한계를 설명합니다."
---

## 경로 표현식 특징

- 상태 필드(state field): 경로 탐색의 끝이며 더 탐색할 수 없습니다.
- 단일 값 연관 경로: 묵시적 내부 조인(inner join)이 발생하며, 탐색이 가능합니다.
- 컬렉션 값 연관 경로: 묵시적 내부 조인이 발생하며, 탐색은 불가능합니다.
    - FROM 절에서 명시적 조인을 통해 별칭을 얻으면 별칭을 통해 탐색할 수 있습니다.

결론: 묵시적 조인은 실무에서 쓰면 안 됩니다. 유지보수하기도 힘들기 때문입니다. 그러므로 항상 명시적 조인으로 작성해야 합니다.

## 상태 필드 경로 탐색

- JPQL: select m.username, m.age from Member m
- SQL: select m.username, m.age from Member m

단일 값 연관 경로 탐색

- JPQL:

```sql
select o.member
  from Order o
```

- SQL:

```sql
select m.*
  from Orders o
 inner join Member m on o.member_id = m.id
```

묵시적 조인은 문제를 일으킬 가능성이 큽니다.

## 명시적 조인, 묵시적 조인

- 명시적 조인: join 키워드를 직접 사용합니다.
    - select m from Member m join m.team t
- 묵시적 조인: 경로 표현식에 의해 묵시적으로 SQL 조인이 발생합니다(내부 조인만 가능).
    - select m.team from Member m

## 경로 표현식 - 예제

- select o.member.team from Order o : 성공
- select t.members from Team t : 성공
- select t.members.username from Team t : 실패
- select m.username from Team t join t.members m : 성공

## 경로 탐색을 사용한 묵시적 조인 시 주의사항

- 항상 내부 조인입니다.
- 컬렉션은 경로 탐색의 끝이므로 명시적 조인을 통해 별칭을 얻어야 합니다.
- 경로 탐색은 주로 SELECT, WHERE 절에서 사용하지만 묵시적 조인으로 인해 SQL의 FROM(JOIN) 절에 영향을 줍니다.

## 실무 조언

- 가급적 묵시적 조인 대신 명시적 조인을 사용합니다.
- 조인은 SQL 튜닝의 중요한 포인트입니다.
- 묵시적 조인은 조인이 일어나는 상황을 한눈에 파악하기 어렵습니다.

## 페치 조인(fetch join)

- SQL 조인 종류가 아닙니다.
- JPQL에서 성능 최적화를 위해 제공하는 기능입니다.
- 연관된 엔티티나 컬렉션을 SQL 한 번에 함께 조회하는 기능입니다.
- join fetch 명령어를 사용합니다.
- 페치 조인 ::= [ LEFT [OUTER] | INNER] JOIN FETCH 조인 경로

```java
String jpql = "select m from Member m join fetch m.team";
List<Member> members = em.createQuery(jpql, Member.class)
 	.getResultList();
for (Member member : members) {
//페치 조인으로 회원과 팀을 함께 조회해서 지연 로딩X
 	System.out.println("username = " + member.getUsername() + ", " +
 	"teamName = " + member.getTeam().name());
}
```

## 컬렉션 페치 조인

- 일대다 관계의 컬렉션 페치 조인입니다.
- [JPQL]

```java
select t
  from Team join fetch t.members
 where t.name = '팀A'
```

- [SQL]

```java
SELECT  T.*, M.*
  FROM TEAM T
 INNER JOIN MEMBER M ON T.ID=T.TEAM_ID
 WHERE T.NAME = '팀A'
```

예제

```java
public class JpaMain {

    public static void main(String[] args) {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("hello");// 애플리케이션 에서 한개만 만들어 져야된다.

        EntityManager em = emf.createEntityManager();//하나의 단위를 만들때마다 만들어 줘야된다.

        EntityTransaction tx = em.getTransaction();
        tx.begin();

        try {
            Team teamA = new Team();
            teamA.setName("팀A");
            em.persist(teamA);

            Team teamB = new Team();
            teamB.setName("팀B");
            em.persist(teamB);

            Member member1 = new Member();
            member1.setUsername("TeamA");
            member1.setAge(10);
            member1.setTeam(teamA);
            em.persist(member1);

            Member member2 = new Member();
            member2.setUsername("TeamA");
            member2.setTeam(teamA);
            member2.setAge(10);
            em.persist(member2);

            Member member3 = new Member();
            member3.setUsername("TeamB");
            member3.setTeam(teamB);
            member3.setAge(10);
            em.persist(member3);

            em.flush();
            em.clear();

            String query = "select t FROM Team t join fetch t.memberList";
//String query = "select m FROM Member m";// From 절에서 명시적 조인을 통해서 별칭을 얻으면 별칭을 통해 탐색 가능.

            List<Team> resultList = em.createQuery(query, Team.class)
                    .getResultList();

            for (Team team : resultList) {
                System.out.println("Member = " + team.getName() + ", "+ team.getMemberList().size());
                for(Member member : team.getMemberList()) {
                    System.out.println("- member = " + member);
                }
            }
```

결과 값이 중복으로 나옵니다.

## 페치 조인과 DISTINCT

- JPQL의 DISTINCT는 2가지 기능을 제공합니다.
    - 1. SQL에 DISTINCT를 추가합니다.
    - 2. 애플리케이션에서 엔티티 중복을 제거합니다.

## 페치 조인과 DISTINCT 설명

- SQL에 DISTINCT를 추가하지만 데이터가 다르므로 SQL 결과에서는 중복 제거에 실패합니다.
- SQL의 DISTINCT는 결과값이 완전히 일치해야 제거됩니다.
- 현재 소스 코드에서는 애플리케이션으로 올라올 때 컬렉션 안의 값이 중복이라 JPA가 제거해주는 것입니다.

## 페치 조인과 일반 조인의 차이

- 일반 조인을 실행하면 연관된 엔티티를 함께 조회하지 않습니다.
- [JPQL]

```java
select t
  from Team t join t.members m
 where t.name = '팀A'
```

- [SQL]

```java
SELECT T.*
  FROM TEAM T
 INNER JOIN MEMBER M ON T.ID = M.TEAM_ID
 WHERE T.NAME = '팀A'
```

## 페치 조인

- 페치 조인을 사용할 때만 연관된 엔티티도 함께 조회합니다.
- 페치 조인은 객체 그래프를 SQL 한 번에 조회하는 개념입니다.

## 페치 조인의 특징과 한계

- 페치 조인 대상에는 별칭을 줄 수 없습니다.
    - 하이버네이트에서는 가능하지만 가급적 사용하지 않습니다.
- 둘 이상의 컬렉션은 페치 조인할 수 없습니다.
- 컬렉션을 페치 조인하면 페이징 API를 사용할 수 없습니다.
    - 일대일, 다대일 같은 단일 값 연관 필드는 페치 조인해도 페이징이 가능합니다.
    - 하이버네이트는 경고 로그를 남기고 메모리에서 페이징하는데(매우 위험), 절대 사용하면 안 됩니다.

## 페치 조인의 특징과 한계

- 연관된 엔티티들을 SQL 한 번으로 조회하여 성능을 최적화합니다.
- 엔티티에 직접 적용하는 글로벌 로딩 전략보다 우선합니다.
- 실무에서 글로벌 로딩 전략은 모두 지연 로딩으로 설정합니다.
- 최적화가 필요한 곳에 페치 조인을 적용합니다.

## 페치 조인 - 정리

- 모든 것을 페치 조인으로 해결할 수는 없습니다.
- 페치 조인은 객체 그래프를 유지할 때 사용하면 효과적입니다.
- 여러 테이블을 조인해서 엔티티가 가진 모양이 아닌 전혀 다른 결과를 내야 한다면, 페치 조인보다는 일반 조인을 사용하고 필요한 데이터만 조회해서 DTO로 반환하는 것이 효과적입니다.

> 이 글은 인프런 김영한 님의 [자바 ORM 표준 JPA 프로그래밍 — 기본편](https://www.inflearn.com/course/ORM-JPA-Basic)을 들으며 정리한 노트입니다.
