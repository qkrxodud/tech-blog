---
title: "스프링 JPA 통합 테스트"
tags: ["Spring","JPA","EntityManager","Transactional","통합 테스트"]
summary: "JPA 엔티티 매핑과 EntityManager 기반 리포지토리를 구현하고, SpringConfig의 빈 설정만 바꿔 JDBC 구현체를 JPA로 교체하는 과정을 정리합니다."
---

JPA를 사용하면 SQL과 데이터 중심의 설계에서 객체 중심의 설계로 패러다임을 전환할 수 있습니다.

JPA를 사용하면 개발 생산성을 크게 높일 수 있습니다.

## 1) build.gradle을 통한 외부 라이브러리 임포트

- 기존에 사용했던 jdbc를 주석 처리한 후 data-jpa를 작성해줍니다.

```java
dependencies {
	implementation 'org.springframework.boot:spring-boot-starter-thymeleaf'
	implementation 'org.springframework.boot:spring-boot-starter-web'
//implementation 'org.springframework.boot:spring-boot-starter-jdbc'
	implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
	runtimeOnly 'com.h2database:h2'
	testImplementation 'org.springframework.boot:spring-boot-starter-test'
}
```

## 2) application.properties 값으로 환경설정 값을 지정합니다

- spring.jpa.show-sql=true : JPA가 생성하는 SQL을 출력합니다.
- spring.jpa.hibernate.ddl-auto=none : JPA가 테이블을 자동으로 생성해주는 기능을 제공하는데, 해당 기능을 끕니다.

```java
spring.datasource.url=jdbc:h2:tcp://localhost/~/test
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa

spring.jpa.show-sql=true
spring.jpa.hibernate.ddl-auto=none
```

## 3) Member 객체를 JPA 엔티티로 매핑합니다

- @Id : PK를 나타냅니다.
- @GeneratedValue(strategy = GenerationType.IDENTITY) : GenerationType.IDENTITY 옵션을 추가해야만 auto_increment가 적용됩니다.

```java
package hello.hellospring.domain;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;

@Entity
public class Member {

    @Id//PK를 나타낸다.@GeneratedValue(strategy = GenerationType.IDENTITY)//GenerationType.IDENTITY 옵션을 추가해야만 auto_increment가 된다.
    Long id;
    String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }
}
```

## 4) MemberService 객체에 트랜잭션을 추가합니다

- JPA는 모든 데이터 변경을 트랜잭션 안에서 실행시켜야 합니다.
- 현재 클래스는 저장만 사용하므로 join에만 걸어줘도 상관없습니다.

```java
package hello.hellospring.service;

import hello.hellospring.domain.Member;
import hello.hellospring.repository.MemberRepository;
import hello.hellospring.repository.MemoryMemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

//test case 생성 alt + enter@Transactional
public class MemberService {
	...
}
```

## 5) JpaMemberRepository 객체를 구현합니다

- JPA를 사용할 때는 EntityManager를 사용하는데, 이것은 application.properties 설정을 바탕으로 스프링 컨테이너에 빈으로 등록되어 의존성 주입을 받을 수 있습니다.

```java
package hello.hellospring.repository;

import hello.hellospring.domain.Member;

import javax.persistence.EntityManager;
import java.util.List;
import java.util.Optional;

public class JpaMemberRepository implements MemberRepository {
    private final EntityManager em;

//application.properties에서 Spring 컨테이너에 빈으로 등록됨//EntityManager를 의존성 주입 받아야된다.public JpaMemberRepository(EntityManager em) {
        this.em = em;
    }

    public Member save(Member member) {
        em.persist(member);
        return member;
    }

    public Optional<Member> findById(Long id) {
        Member member = em.find(Member.class, id);
        return Optional.ofNullable(member);
    }

    public List<Member> findAll() {
        return em.createQuery("select m from Member m", Member.class)
                .getResultList();
    }

    public Optional<Member> findByName(String name) {
        List<Member> result = em.createQuery("select m from Member m where m.name = :name ", Member.class)
                .setParameter("name", name)
                .getResultList();
        return result.stream().findAny();
    }
}
```

## 6) SpringConfig.java에서 Repository를 JpaMemberRepository로 변경합니다

- SpringConfig.java에서 JpaMemberRepository를 사용하려면 EntityManager를 의존성 주입으로 받아야 합니다.

```java
package hello.hellospring;
import hello.hellospring.repository.JdbcMemberRepository;
import hello.hellospring.repository.JdbcTemplateMemberRepository;
import hello.hellospring.repository.JpaMemberRepository;
import hello.hellospring.repository.MemberRepository;
import hello.hellospring.service.MemberService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.persistence.Entity;
import javax.persistence.EntityManager;
import javax.sql.DataSource;

@Configuration
public class SpringConfig {

    private DataSource dataSource;
    private EntityManager em;

    @Autowired
    public SpringConfig(DataSource dataSource, EntityManager em) {
        this.dataSource = dataSource;
        this.em = em;
    }

    @Bean
    public MemberService memberService() {
        return new MemberService(memberRepository());
    }

    @Bean
    public MemberRepository memberRepository() {
// return new MemoryMemberRepository();// return new JdbcMemberRepository(dataSource);// return new JdbcTemplateMemberRepository(dataSource);return new JpaMemberRepository(em);
    }
}
```

> 결론
>
> JPA를 사용함으로써 쿼리가 현저하게 줄었습니다. 정말 이것으로 현업에서 사용이 가능할까 싶을 정도로 간단하게 되었으며, 많은 기능을 더 살펴보고 싶습니다. JPA도 제대로 들어야겠습니다.

> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.
