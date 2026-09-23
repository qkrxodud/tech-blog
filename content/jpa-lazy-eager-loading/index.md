---
title: "즉시 로딩과 지연 로딩"
tags: ["JPA","지연 로딩","즉시 로딩","프록시","Spring"]
summary: "지연 로딩과 즉시 로딩의 동작 차이를 프록시 조회 관점에서 정리하고, 실무에서 지연 로딩을 써야 하는 이유를 짚습니다."
---

## Member를 조회할 때 Team도 함께 조회해야 할까?

이 물음에 JPA는 지연 로딩과 즉시 로딩이라는 두 가지 답을 마련해 두었습니다.

## 지연 로딩(LAZY)을 사용해서 프록시로 조회

```java
@Entity
public class Member extends BaseEntity {

    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;

    @Column(name = "USERNAME")
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)// 팀을 프록시로 조회한다.@JoinColumn
    private Team team;
```

- em.find(Member.class, 1L)로 조회하면 멤버는 DB에서 조회한 후 영속성 컨텍스트에 저장됩니다. 이때 Team은 프록시(가짜 객체)로 참조값이 null인 상태로 들어갑니다.
- 이후 team.getName()을 호출하는 시점에 해당하는 값을 DB에서 조회(초기화)한 후, 참조 값이 null이던 자리에 데이터를 채워 넣습니다.

---

## 즉시 로딩(EAGER)을 사용해서 함께 조회

```java
@Entity
public class Member extends BaseEntity {

    @Id @GeneratedValue
    @Column(name = "MEMBER_ID")
    private Long id;

    @Column(name = "USERNAME")
    private String name;

    @ManyToOne(fetch = FetchType.EAGER)// 팀을 프록시로 조회한다.@JoinColumn
    private Team team;
```

- 즉시 로딩으로 두면 Member를 조회할 때 Team도 항상 함께 조회됩니다.

## 프록시와 즉시 로딩 주의

- **가급적 지연 로딩만 사용합니다(특히 실무에서).**
- 즉시 로딩을 적용하면 예상하지 못한 SQL이 발생합니다.
- **즉시 로딩은 JPQL에서 N+1 문제를 일으킵니다.**
- **@ManyToOne, @OneToOne은 기본이 즉시 로딩입니다. LAZY로 바꿔 두어야 합니다.**
- @OneToMany, @ManyToMany는 기본이 지연 로딩입니다.

## 지연 로딩 활용 - 실무

- **모든 연관관계에 지연 로딩을 사용하세요!**
- **실무에서 즉시 로딩을 사용하지 마세요!**
- **JPQL 페치 조인이나, 엔티티 그래프 기능을 사용하세요!**
- **즉시 로딩은 상상하지 못한 쿼리가 나갑니다.**

---

> 이 글은 인프런 김영한 님의 [자바 ORM 표준 JPA 프로그래밍 — 기본편](https://www.inflearn.com/course/ORM-JPA-Basic)을 들으며 정리한 노트입니다.
