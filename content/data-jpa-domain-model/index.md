---
title: "예제 도메인 모델과 동작 확인"
tags: ["Spring Data JPA","JPA","@Entity","연관관계","롬복"]
summary: "실습에 사용할 Member, Team 엔티티와 양방향 연관관계를 정의하고, 순수 JPA로 저장·조회 동작을 확인합니다."
---

## 예제 도메인 모델

**Member 엔티티**

```java
package study.datajpa.Entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

import javax.persistence.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString(of = {"id", "userName", "age"})
public class Member {

    @Id @GeneratedValue
    @Column(name = "member_id")
    private Long id;
    private String userName;
    private int age;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    private Team team;

    public Member(String userName) {
        this.userName = userName;
    }

    public Member(String userName, int age, Team team) {
        this.userName = userName;
        this.age = age;
        if (team != null) {
            this.team = team;
        }
    }

    public void changeTeam(Team team) {
        this.team = team;
        team.getMembers().add(this);
    }
}
```

- 롬복 설명
    - @Setter: 실무에서 가급적 Setter는 사용하지 않습니다.
    - @NoArgsConstructor AccessLevel.PROTECTED: 기본 생성자를 막고 싶지만, JPA 스펙상 PROTECTED로 열어두어야 합니다.
    - @ToString은 가급적 내부 필드만(연관관계 없는 필드만) 대상으로 합니다.
- `changeTeam()`으로 양방향 연관관계를 한번에 처리합니다(연관관계 편의 메소드).

**Team 엔티티**

```java
package study.datajpa.Entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import javax.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
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

Member와 Team은 양방향 연관관계이며, `Member.team`이 연관관계의 주인입니다. `Team.members`는 연관관계의 주인이 아니므로, `Member.team`이 데이터베이스 외래키 값을 변경하고 반대편은 읽기만 가능합니다.

**데이터 확인 테스트**

```java
package study.datajpa.Entity;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import java.util.List;

@SpringBootTest
@Transactional
@Rollback(false)
class MemberTest {

    @PersistenceContext
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

        //확인
        List<Member> members = em.createQuery("select m from Member m", Member.class)
                .getResultList();
        for (Member member : members) {
            System.out.println("member = "+ member);
            System.out.println("--> member.team = "+ member.getTeam());
        }
    }

}
```

- 가급적 순수 JPA로 동작을 확인합니다.
- db 테이블 결과 확인
- 지연 로딩 동작 확인

> 이 글은 인프런 김영한 님의 [실전! 스프링 데이터 JPA](https://www.inflearn.com/course/스프링-데이터-JPA-실전)을 들으며 정리한 노트입니다.
