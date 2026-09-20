---
title: "예제 도메인 모델"
tags: ["Querydsl", "JPA", "엔티티 매핑", "연관관계", "Spring Boot"]
summary: "Querydsl 실습에 사용할 Member, Team 엔티티를 설계하고 양방향 연관관계와 롬복 설정을 정리합니다."
---

## 예제 도메인 모델과 동작 확인

**Member 엔티티**

```java
package study.querydsl.entitiy;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

import javax.persistence.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString(of = {"id", "username", "age"})
public class Member {

    @Id @GeneratedValue
    @Column(name = "member_id")
    private Long id;

    private String username;
    private  int age;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tema_id")
    private Team team;

    public Member(String username) {
        this(username, 0);
    }

    public Member(String username, int age) {
        this(username, age,null);
    }

    public Member(String username, int age, Team team) {
        this.username = username;
        this.age = age;
        if(team != null) {
            changeTeam(team);
        }
    }

    private void changeTeam(Team team) {
        this.team = team;
        team.getMembers().add(this);
    }
}
```

**롬복 설명**

- `@Setter`: 실무에서 가급적 Setter는 사용하지 않습니다.
- `@NoArgsConstructor(access = AccessLevel.PROTECTED)`: 기본 생성자를 막고 싶은데, JPA 스펙상 PROTECTED로 열어두어야 합니다.
- `@ToString`은 가급적 내부 필드만(연관관계 없는 필드만) 넣습니다.

`changeTeam()`으로 양방향 연관관계를 한 번에 처리합니다(연관관계 편의 메소드).

**Team 엔티티**

```java
package study.querydsl.entitiy;

import lombok.*;

import javax.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString(of = {"id", "name"})
public class Team {

    @Id @GeneratedValue
    @Column(name = "team_id")
    private Long id;

    private String name;
    @OneToMany(mappedBy = "team")
    private List<Member> members = new ArrayList<>();

    public Team(String name) {
        this.name = name;
    }
}
```

Member와 Team은 양방향 연관관계이며, `Member.team`이 연관관계의 주인이고 `Team.members`는 연관관계의 주인이 아닙니다. 따라서 `Member.team`이 데이터베이스 외래키 값을 변경하고, 반대편은 읽기만 가능합니다.

**데이터 확인 테스트**

```java
package study.querydsl.entitiy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.Commit;
import org.springframework.transaction.annotation.Transactional;
import javax.persistence.EntityManager;
import java.util.List;

@SpringBootTest
@Transactional
@Commit
class MemberTest {

    @Autowired
    EntityManager em;

    @Test
    public void testEntity() {
        Team teamA = new Team("teamA");
        Team teamB = new Team("teamB");
        em.persist(teamA);
        em.persist(teamB);

        Member member1 = new Member("member1", 10, teamA);
        Member member2 = new Member("member2", 20, teamA);

        Member member3 = new Member("member3", 30, teamB);
        Member member4 = new Member("member4", 40, teamB);

        em.persist(member1);
        em.persist(member2);
        em.persist(member3);
        em.persist(member4);

        //초기화
        em.flush();
        em.clear();

        List<Member> members = em.createQuery("select m from Member m " +
                        "join fetch m.team t", Member.class)
                .getResultList();
        for (Member member : members) {
            System.out.println("member = " + member);
            System.out.println("member.team = " + member.getTeam());
        }

    }
}
```

- 가급적 순수 JPA로 동작을 확인합니다(뒤에서 변경합니다).
- DB 테이블 결과를 확인합니다.
- 지연 로딩 동작을 확인합니다.

> 이 글은 인프런 김영한 님의 [실전! Querydsl](https://www.inflearn.com/course/querydsl-실전)을 들으며 정리한 노트입니다.
