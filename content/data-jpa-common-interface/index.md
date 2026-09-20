---
title: "공통 인터페이스 기능"
tags: ["Spring Data JPA", "JPA", "JpaRepository", "CRUD", "Spring"]
summary: "순수 JPA로 기본 CRUD 리포지토리를 만들어본 뒤, 스프링 데이터 JPA의 공통 인터페이스 JpaRepository로 대체하는 과정을 정리합니다."
---

## 공통 인터페이스 기능

- 순수 JPA 기반 리포지토리 만들기
- 스프링 데이터 JPA 공통 인터페이스 소개
- 스프링 데이터 JPA 공통 인터페이스 활용

## 순수 JPA 기반 리포지토리 만들기

- 순수한 JPA 기반 리포지토리를 만듭니다.
- 기본 CRUD
    - 저장
    - 변경 → 변경감지 사용
    - 삭제
    - 전체 조회
    - 단건 조회
    - 카운트

> 참고: JPA에서 수정은 변경감지 기능을 사용하면 됩니다.
>
> 트랜잭션 안에서 엔티티를 조회한 다음에 데이터를 변경하면, 트랜잭션 종료 시점에 변경감지 기능이 작동해서 변경된 엔티티를 감지하고 UPDATE SQL을 실행합니다.

**순수 JPA 기반 리포지토리 - 회원**

```java
package study.datajpa.repository;

import org.springframework.stereotype.Repository;
import study.datajpa.Entity.Member;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import java.util.List;
import java.util.Optional;

@Repository
public class MemberJpaRepository {
    @PersistenceContext
    private EntityManager em;

    public Member save(Member member) {
        em.persist(member);
        return member;
    }

    public void delete(Member member) {
        em.remove(member);
    }

    public List<Member> findAll() {
        return em.createQuery("Select m from Member m" , Member.class)
                .getResultList();
    }

    public Optional<Member> findById (Long memberId) {
        Member member = em.find(Member.class, memberId);
        return Optional.ofNullable(member);
    }

    public long count() {
        return em.createQuery("Select count(m) from Member m", Long.class)
                .getSingleResult();
    }

    public Member find(Long id) {
        return em.find(Member.class, id);
    }
}
```

**순수 JPA 기반 리포지토리 - 팀**

```java
package study.datajpa.repository;

import org.springframework.stereotype.Repository;
import study.datajpa.Entity.Member;
import study.datajpa.Entity.Team;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import java.util.List;

@Repository
public class TeamJapRepository {

    @PersistenceContext
    private EntityManager em;

    public Team save(Team team) {
        em.persist(team);
        return team;
    }

    public void delete(Team team) {
        em.remove(team);
    }

    public List<Team> findAll() {
        return em.createQuery("select t from Team t", Team.class)
                .getResultList();
    }

    public long Count() {
        return em.createQuery("select count(t) from Team t", Long.class)
                .getSingleResult();
    }

}
```

회원 리포지토리와 거의 동일합니다.

**순수 JPA 기반 리포지토리 테스트**

```java
package study.datajpa.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;
import study.datajpa.Entity.Member;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
@Rollback(false)
class MemberJpaRepositoryTest {

    @Autowired
    MemberJpaRepository jpaRepository;

    @Test
    public void testMember() {
        Member member = new Member("memberA");
        Member saveMember = jpaRepository.save(member);
        Member findMember = jpaRepository.find(saveMember.getId());

        assertThat(findMember.getId()).isEqualTo(member.getId());
        assertThat(findMember.getUserName()).isEqualTo(member.getUserName());

        assertThat(findMember).isEqualTo(member);
    }

    @Test
    public void basicCRUD() {
        Member member1 = new Member("member1");
        Member member2 = new Member("member2");
        jpaRepository.save(member1);
        jpaRepository.save(member2);

        //단건 조회 검증
        Member findMember1 = jpaRepository.findById(member1.getId()).get();
        Member findMember2 = jpaRepository.findById(member2.getId()).get();
        assertThat(findMember1).isEqualTo(member1);
        assertThat(findMember2).isEqualTo(member2);

        //리스트 조회 검증
        List<Member> all = jpaRepository.findAll();
        assertThat(all.size()).isEqualTo(2);

        //카운트 검증
        long count = jpaRepository.count();
        assertThat(count).isEqualTo(2);

        //삭제 검증
        jpaRepository.delete(member1);
        jpaRepository.delete(member2);
        long deletedCount = jpaRepository.count();
        assertThat(deletedCount).isEqualTo(0);
    }
}
```

기본 CRUD를 검증합니다.

## 공통 인터페이스 설정

**javaConfig 설정 - 스프링 부트 사용시 생략 가능**

```java
@Configuration
@EnableJpaRepositories(basePackages = "jpabook.jpashop.repository")
public class AppConfig {}
```

- 스프링 부트 사용시 @SpringBootApplication 위치를 지정(해당 패키지와 하위 패키지 인식)
- 만약 위치가 달라지면 `@EnableJpaRepositories` 필요

스프링 데이터 JPA가 구현 클래스 대신 생성합니다.

- `org.springframework.data.repository.Repository`를 구현한 클래스는 스캔 대상입니다.
    - MemberRepository 인터페이스가 동작한 이유
    - 실제 출력해보면 Proxy가 노출됩니다.
    - memberRepository.getClass() → class com.sun.proxy.$ProxyXXX
- `@Repository` 애노테이션 생략 가능
    - 컴포넌트 스캔을 스프링 데이터 JPA가 자동으로 처리합니다.
    - JPA 예외를 스프링 예외로 변환하는 과정도 자동으로 처리합니다.

## 공통 인터페이스 적용

순수 JPA로 구현한 `MemberJpaRepository` 대신에 스프링 데이터 JPA가 제공하는 공통 인터페이스를 사용합니다.

**스프링 데이터 JPA 기반 MemberRepository**

```java
public interface MemberRepository extends JpaRepository<Member, Long> {
}
```

**MemberRepository 테스트**

```java
package study.datajpa.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;
import study.datajpa.Entity.Member;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
@Rollback(value = false)

class MemberRepositoryTest {

    @Autowired
    MemberRepository memberRepository;

    @Test
    public void testMember() {
        Member member = new Member("memberA");
        Member saveMember = memberRepository.save(member);

        Member findMember = memberRepository.findById(member.getId()).get();

        assertThat(findMember.getId()).isEqualTo(member.getId());
        assertThat(findMember.getUserName()).isEqualTo(member.getUserName());

        assertThat(findMember).isEqualTo(member);
    }

    @Test
    public void basicCRUD() {
        Member member1 = new Member("member1");
        Member member2 = new Member("member2");
        memberRepository.save(member1);
        memberRepository.save(member2);

        //단건 조회 검증
        Member findMember1 = memberRepository.findById(member1.getId()).get();
        Member findMember2 = memberRepository.findById(member2.getId()).get();
        assertThat(findMember1).isEqualTo(member1);
        assertThat(findMember2).isEqualTo(member2);

        //리스트 조회 검증
        List<Member> all = memberRepository.findAll();
        assertThat(all.size()).isEqualTo(2);

        //카운트 검증
        long count = memberRepository.count();
        assertThat(count).isEqualTo(2);

        //삭제 검증
        memberRepository.delete(member1);
        memberRepository.delete(member2);
        long deletedCount = memberRepository.count();
        assertThat(deletedCount).isEqualTo(0);
    }

}
```

기존 순수 JPA 기반 테스트에서 사용했던 코드를 그대로 스프링 데이터 JPA 리포지토리 기반 테스트로 변경해도 동일한 방식으로 동작합니다.

**TeamRepository 생성**

```java
package study.datajpa.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import study.datajpa.Entity.Team;

public interface TeamRepository extends JpaRepository<Team, Long> {
}
```

- TeamRepository는 테스트 생략
- Generic
    - T: 엔티티 타입
    - ID: 식별자 타입(PK)

## 공통 인터페이스 분석

- JpaRepository 인터페이스: 공통 CRUD 제공
- 제네릭은 <엔티티 타입, 식별자 타입> 설정

*`JpaRepository` 공통 기능 인터페이스*

```java
public interface JpaRepository<T, ID extends Serializable>
	extends PagingAndSortingRepository<T, ID>
	{
		...
	}
```

*`JpaRepository`를 사용하는 인터페이스*

```java
public interface MemberRepository extends JpaRepository<Member, Long> {
}
```

**주의**

- `T findOne(ID)` → `Optional<T> findById(ID)` 변경

제네릭 타입

- `T`: 엔티티
- `ID`: 엔티티의 식별자 타입
- `S`: 엔티티와 그 자식 타입

주요 메서드

- `save(S)`: 새로운 엔티티는 저장하고 이미 있는 엔티티는 병합합니다.
- `delete(T)`: 엔티티 하나를 삭제합니다. 내부에서 `EntityManager.remove()`를 호출합니다.
- `findById(ID)`: 엔티티 하나를 조회합니다. 내부에서 `EntityManager.find()`를 호출합니다.
- `getOne(ID)`: 엔티티를 프록시로 조회합니다. 내부에서 `EntityManager.getReference()`를 호출합니다.
- `findAll(...)`: 모든 엔티티를 조회합니다. 정렬(`Sort`)이나 페이징(`Pageable`) 조건을 파라미터로 제공할 수 있습니다.

> 참고: `JpaRepository`는 대부분의 공통 메서드를 제공합니다.

> 이 글은 인프런 김영한 님의 [실전! 스프링 데이터 JPA](https://www.inflearn.com/course/스프링-데이터-JPA-실전)을 들으며 정리한 노트입니다.
