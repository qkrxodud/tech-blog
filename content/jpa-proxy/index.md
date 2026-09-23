---
title: "프록시의 동작 원리"
tags: ["JPA","프록시","Hibernate","영속성 컨텍스트","지연 로딩"]
summary: "JPA 프록시 객체가 만들어지고 초기화되는 과정을 em.getReference() 예제로 살펴보고, 프록시 사용 시 주의할 점을 정리합니다."
---

## Member를 조회할 때 Team도 함께 조회해야 할까

**문제 발생**

연관관계를 맺으면 회원의 이름만 조회하고 싶은데도 팀의 정보까지 매핑되어 함께 조회되는 자원 낭비가 발생할 수 있습니다. 이를 해결하기 위해 프록시를 사용합니다.

회원과 팀 함께 출력

```java
public void printUserAndTeam(String memberId) {
    Member member = em.find(Member.class, memberId);
    Team team = member.getTeam();
    System.out.println("회원 이름: " + member.getUsername());
    System.out.println("소속팀: " + team.getName());
}
```

회원만 출력

```java
public void printUser(String memberId) {
    Member member = em.find(Member.class, memberId);
    Team team = member.getTeam();
    System.out.println("회원 이름: " + member.getUsername());
}
```

## 프록시 기초

- em.find() vs em.getReference()
- em.find(): 데이터베이스를 통해 실제 엔티티 객체를 조회합니다.
- em.getReference(): 데이터베이스 조회를 미루는 가짜(프록시) 엔티티 객체를 조회합니다.

## 프록시 특징

- 실제 클래스를 상속받아서 만들어집니다.
- 실제 클래스와 겉모양이 같습니다.
- 사용하는 입장에서는 진짜 객체인지 프록시 객체인지 구분하지 않고 사용하면 됩니다.

## 프록시 특징

- 프록시 객체는 실제 객체의 참조(target)를 보관합니다.
- 프록시 객체를 호출하면 프록시 객체는 실제 객체의 메소드를 호출합니다.

## 프록시 객체의 초기화

```java
Member member = em.getReference(Member.class, "id1");
member.getName();
```

1. em.getReference()를 호출하면 Entity target이 null 값인 멤버 프록시 객체를 가져옵니다.
2. member.getName()을 호출하면 멤버 타깃에 값이 없으므로 초기화를 요청합니다.
3. JPA가 영속성 컨텍스트에 초기화를 요청합니다.
4. 영속성 컨텍스트가 DB를 조회한 후 실제 Entity를 Member 객체에 전달합니다.
5. 이후 MemberProxy 객체의 멤버 타깃에 멤버의 참조값을 넣어줍니다.

```java
package helloJpa;
...

public class JpaMain {

    public static void main(String[] args) {
        ...

        try {
            Member member = new Member();
            member.setName("hello ");

            em.persist(member);

            em.flush();
            em.clear();

            System.out.println("============call getReference START ==========");
            Member findMember = em.getReference(Member.class, member.getId());
            System.out.println("============call getReference END ==========");
            System.out.println("============call findMember.getName() START ==========");
            System.out.println("findMember.userName = " + findMember.getName());
            System.out.println("============call findMember.getName() END ==========");
            System.out.println("findMember.userName = " + findMember.getName());

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

위 예제를 보면 findMember.getName()을 호출하는 순간 프록시가 한 번 초기화되는 것을 확인할 수 있습니다.

## 프록시의 특징

- 프록시 객체는 처음 사용할 때 한 번만 초기화됩니다.
- 프록시 객체를 초기화한다고 해서 프록시 객체가 실제 엔티티로 바뀌는 것은 아니며, 초기화되면 프록시 객체를 통해 실제 엔티티에 접근할 수 있습니다.
- 프록시 객체는 원본 엔티티를 상속받으므로 타입 체크 시 주의해야 합니다(== 비교는 실패하므로 대신 instanceof를 사용합니다).
- 영속성 컨텍스트에 찾는 엔티티가 이미 있으면 em.getReference()를 호출해도 실제 엔티티를 반환합니다.
- 영속성 컨텍스트의 도움을 받을 수 없는 준영속 상태에서 프록시를 초기화하면 문제가 발생합니다(하이버네이트는 org.hibernate.LazyInitializationException 예외를 던집니다).

## 프록시 확인

- 프록시 인스턴스의 초기화 여부 확인
    - PersistenceUnitUtil.isLoaded(Object entity)
- 프록시 클래스 확인 방법
    - entity.getClass().getName() 출력
- 프록시 강제 초기화
    - Hibernate.initialize(Entity);
- 참고: JPA 표준은 강제 초기화 없음
    - 강제 호출: member.getName();

> 이 글은 인프런 김영한 님의 [자바 ORM 표준 JPA 프로그래밍 — 기본편](https://www.inflearn.com/course/ORM-JPA-Basic)을 들으며 정리한 노트입니다.
