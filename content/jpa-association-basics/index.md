---
title: "연관관계 매핑 기초"
tags: ["JPA", "연관관계 매핑", "단방향", "양방향", "연관관계의 주인"]
summary: "객체와 테이블의 연관관계 차이를 이해하고, 단방향·양방향 매핑과 연관관계의 주인을 정하는 기준을 예제로 정리합니다."
---

## 연관관계 매핑

목표

- 객체와 테이블 연관관계의 차이를 이해합니다.
- 객체의 참조와 테이블의 외래 키를 매핑합니다.
- 용어
    - 방향(Direction): 단방향, 양방향
    - 다중성 : 다대일(N:1), 일대다(1:N), 일대일(1:1), 다대다(N:M) 이해
    - 연관관계의 주인(Owner): 객체 양방향 연관관계는 관리 주인이 필요

## 연관관계가 필요한 이유

> 객체지향 설계의 목표는 자율적인 객체들의 협력 공동체를 만드는 것입니다.

## 예제 시나리오

- 회원과 팀이 있습니다.
- 회원은 하나의 팀에만 소속될 수 있습니다.
- 회원과 팀은 다대일 관계입니다.

## 단방향 연관관계

### 객체를 테이블에 맞추어 모델링

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
            Team team = new Team();
            team.setName("TeamA");
            em.persist(team);

            Member member = new Member();
            member.setName("member1");
            member.setTeamId(team.getId());
            em.persist(member);

            Member findMember = em.find(Member.class, member.getId());
            Long findTeamId = findMember.getTeamId();
            Team findTeam = em.find(Team.class, findTeamId);

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

**문제 발생**

- 객체를 테이블에 맞춰 모델링하다 보니 객체지향적이지 않고 뭔가 이상한 점을 느낄 수 있습니다.
- 바로 teamId를 넣었을 때 팀을 세팅하고 값을 가져오는 부분입니다.
- 객체지향이라면 분명 member 안에 Team이 있어야 합니다. member.setTeam(team);

**조회 시 문제 발생**

- 조회할 때도 멤버의 id 값으로 팀의 id 값을 조회한 후, 조회한 id로 팀 이름을 찾아야 합니다.
- 조회할 때마다 DB에서 계속 꺼내는 일이 발생합니다. 연관관계가 없기 때문입니다.
- 전혀 객체지향스럽지 못합니다.

**결론**

- 객체를 테이블에 맞추어 데이터 중심으로 모델링하면 협력 관계를 만들 수 없습니다.
- 테이블은 외래 키로 조인을 사용해서 연관된 테이블을 찾습니다.
- 객체는 참조를 사용해서 연관된 객체를 찾습니다.
- 테이블과 객체 사이에는 이런 큰 간격이 있습니다.

### 객체지향 모델링

- 위 멤버 객체에서 Member에게는 Many, Team에게는 One으로 다대일 관계를 맺어주고
- 조인은 TEAM_ID 컬럼으로 한다고 명시해줌으로써 연관관계를 매핑해줬습니다.

```kotlin
package helloJpa;

import javax.persistence.*;
import java.util.Date;

@Entity
public class Member {

  ...
//    
@Column(name = "TEAM_NO")//    
private Long teamId;

@ManyToOne// JPA에게 일대다 다대일 관계인지 알려줘야된다.
@JoinColumn(name = "TEAM_ID")// 어떤 컬럼명으로 조인을 할지 알려줘야한다.
private Team team;

   ...
}
```

```java
package helloJpa;

import javax.persistence.EntityManager;
import javax.persistence.EntityManagerFactory;
import javax.persistence.EntityTransaction;
import javax.persistence.Persistence;
import java.util.List;

public class JpaMain {

    public static void main(String[] args) {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("hello");// 애플리케이션 에서 한개만 만들어 져야된다.EntityManager em = emf.createEntityManager();//하나의 단위를 만들때마다 만들어 줘야된다.EntityTransaction tx = em.getTransaction();
        tx.begin();

        try {
// 저장Team team = new Team();
            team.setName("TeamA");
            em.persist(team);

            Member member = new Member();
            member.setName("member1");
            member.setTeam(team);

            em.persist(member);

            Member findMember = em.find(Member.class, member.getId());
            Team findTeam = findMember.getTeam();

            System.out.println("findTeamName = " + findTeam.getName());

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

## 양방향 연관관계와 연관관계의 주인

- 테이블 연관관계는 단방향 예제와 차이가 없습니다. 테이블은 외래 키로 조인을 하기 때문입니다.
- 하지만 객체는 멤버에서 팀으로 가는 단방향은 있었지만 팀에서 멤버로 가는 방향은 없었습니다.
- 가는 방법을 만들기 위해 팀에 List members를 추가했습니다.

### 연관관계의 주인과 mappedBy

```java
@Entity
public class Team {

    @Id
    @GeneratedValue
    @Column(name = "TEAM_ID")
    private Long id;
    private String name;

    @OneToMany(mappedBy = "team")
    private List<Member> members = new ArrayList<>();

	...
}
```

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
// 저장
            ...

            Member findMember = em.find(Member.class, member.getId());
            List<Member> members = findMember.getTeam().getMembers();

            for (Member member1 : members) {
                System.out.println(member1.getName());
            }

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

- mappedBy는 JPA 학습 난이도 중 멘붕 난이도라고 할 수 있습니다.
- mappedBy는 처음에는 이해하기 어렵습니다.
- 객체와 테이블 간에 연관관계를 맺는 차이를 이해해야 합니다.

## 객체와 테이블이 관계를 맺는 차이

- 객체 연관관계 = 2개
    - 회원 → 팀 연관관계 1개(단방향)
    - 팀 → 회원 연관관계 1개(단방향)
- 테이블 연관관계 = 1개
    - 회원 ↔ 팀의 연관관계 1개(양방향)

테이블은 외래 키로 연관관계가 끝나지만, 객체는 연관관계를 2개 잡아줘야 하기 때문에 차이가 있습니다.

## 객체의 양방향 관계

- 객체의 양방향 관계는 사실 양방향 관계가 아니라 서로 다른 단방향 관계 2개입니다.
- 객체를 양방향으로 참조하려면 단방향 연관관계를 2개 만들어야 합니다.
- A→B (a.getB())
- B→A (b.getA())

## 테이블의 양방향 연관관계

- 테이블은 외래 키 하나로 두 테이블의 연관관계를 관리합니다.
- MEMBER.TEAM_ID 외래 키 하나로 양방향 연관관계를 가집니다(양쪽으로 조인할 수 있습니다).

```sql
SELECT *
  FROM MEMBER M
  JOIN TEAM T ON M.TEAM_ID = T.TEAM_ID

SELECT *
  FROM TEAM T
  JOIN MEMBER M ON T.TEAM_ID = M.TEAM_ID
```

## 둘 중 하나로 외래 키를 관리해야 합니다

- Member의 Team 값을 변경했을 때 Member의 외래 키를 변경해야 할지,
- Team의 members 값을 변경했을 때 Member의 외래 키를 변경해야 할지, 딜레마가 생깁니다.
- 하지만 DB 기준으로는 외래 키 값만 변경하면 됩니다.
- 그래서 규칙이 생깁니다. 둘 중 하나를 주인으로 둬야 합니다.

## 연관관계의 주인(Owner)

**양방향 매핑 규칙**

- 객체의 두 관계 중 하나를 연관관계의 주인으로 지정합니다.
- **연관관계의 주인만이 외래 키를 관리(등록, 수정)합니다.**
- **주인이 아닌 쪽은 읽기만 가능합니다.**
- 주인은 mappedBy 속성을 사용하지 않습니다.
- 주인이 아니면 mappedBy 속성으로 주인을 지정합니다.

## 누구를 주인으로 정할까

- **외래 키가 있는 곳을 주인으로 정합니다.**
- 여기서는 Member.team이 연관관계의 주인입니다.

## 양방향 매핑 시 가장 많이 하는 실수

**(연관관계의 주인에 값을 입력하지 않음)**

```java
Member member = new Member();
member.setName("member1");
em.persist(member);

Team team = new Team();
team.setName("TeamA");

//역방향(주인이 아닌 방향)만 연관관계 설정정
team.getMembers().add(member);
em.persist(team);
```

- 결론은 연관관계 주인을 통해서 넣어야 합니다.
- **가장 좋은 것은 객체지향처럼 양쪽 다 넣는 것입니다.**

## 양방향 연관관계 주의 - 실습

- 순수 객체 상태를 고려해서 항상 양쪽에 값을 설정합시다.
- 연관관계 편의 메서드를 생성합시다.
- 양방향 매핑 시 무한 루프를 조심합시다.
    - 예: toString(), lombok, JSON 생성 라이브러리

```java
package helloJpa;

import javax.persistence.*;
import java.util.Date;

@Entity
public class Member {

    @Id
    @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;

    @Column(name = "USERNAME")
    private String name;

//    @Column(name = "TEAM_NO")
//    private Long teamId;

    // JPA에게 일대다 다대일 관계인지 알려줘야된다.
    @ManyToOne
    @JoinColumn(name = "TEAM_ID")
    private Team team;

    public void setTeam(Team team) {
        this.team = team;
        team.getMembers().add(this);
    }

    ...

}
```

## 양방향 매핑 정리

- **단방향 매핑만으로도 이미 연관관계 매핑은 완료됩니다.**
- 양방향 매핑은 반대 방향으로 조회(객체 그래프 탐색)하는 기능이 추가된 것뿐입니다.
- JPQL에서 역방향으로 탐색할 일이 많습니다.
- 단방향 매핑을 잘하고 양방향은 필요할 때 추가해도 됩니다.

**결론**

테이블을 어떻게 연관관계로 매핑하는지 궁금했습니다. 정말 간단하게 해결할 수 있었지만, 사용하는 개념에 대해서는 정확하게 알고 사용해야겠다는 생각을 했습니다. 잘못 사용하면 정말 헤어 나올 수 없는 오류를 범할 수도 있다는 생각이 듭니다.

> 이 글은 인프런 김영한 님의 [자바 ORM 표준 JPA 프로그래밍 — 기본편](https://www.inflearn.com/course/ORM-JPA-Basic)을 들으며 정리한 노트입니다.
