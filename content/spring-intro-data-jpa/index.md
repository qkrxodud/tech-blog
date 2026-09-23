---
title: "스프링 데이터 JPA와 통합 테스트"
tags: ["Spring","Spring Data JPA","JpaRepository","리포지토리","SpringConfig"]
summary: "JpaRepository를 상속하는 인터페이스만으로 리포지토리 구현체를 자동 생성하는 스프링 데이터 JPA 사용법을 정리합니다."
---

스프링 데이터 JPA를 사용하면 리포지토리에 구현 클래스 없이 인터페이스만으로 개발을 완료할 수 있습니다.

사용법을 알아보겠습니다.

## 1) SpringDataJpaMemberRepository 인터페이스 생성

1. SpringDataJpaMemberRepository 인터페이스가 JpaRepository<Member, Long>과 MemberRepository를 상속받도록 만듭니다.
2. 상속을 받으면 스프링 데이터 JPA가 JpaRepository를 상속받은 클래스의 구현체를 자동으로 만들어주고, 만들어진 구현체를 스프링 빈으로 자동 등록해줍니다.
3. 이제 SpringConfig에서 등록된 MemberRepository를 사용하면 됩니다.

```
package hello.hellospring.repository;

import hello.hellospring.domain.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SpringDataJapMemberRepository extends JpaRepository<Member, Long>, MemberRepository {

    @Override
    Optional<Member> findByName(String name);
}
```

- 여기서 부연설명을 하자면, findByName을 따로 만든 이유는 데이터베이스마다 조회할 때 엔티티 정보가 전부 다르기 때문에 해당하는 값은 직접 지정해줘야 하기 때문입니다. 또한 추가적인 엔티티로 조회하려면 findByNameAndIdAnd... 이런 식으로 추가해주면 됩니다.

## 2) SpringConfig 의존성 주입

자동으로 등록된 MemberRepository로 변경합니다.

```java
package hello.hellospring;
import hello.hellospring.repository.MemberRepository;
import hello.hellospring.service.MemberService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SpringConfig {

    private final MemberRepository memberRepository;

    public SpringConfig(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    @Bean
    public MemberService memberService() {
        return new MemberService(memberRepository);
    }

/*@Bean
    public MemberRepository memberRepository() {
        // return new MemoryMemberRepository();
        // return new JdbcMemberRepository(dataSource);
        // return new JdbcTemplateMemberRepository(dataSource);
        // return new JpaMemberRepository(em);
    }*/
}
```

> 결론
>
> 이제 쿼리 하나 없이 인터페이스를 구현한 것만으로 데이터 조회, 추가, 삭제 등 간단한 쿼리들을 작성할 수 있습니다. 그리고 복잡한 쿼리는 JdbcTemplate이나 마이바티스 등 여러 조합을 통해서 조회하면 된다고 설명합니다. 이후에 JPA를 배울 예정이지만, 해당 기술을 접하지 못한 사람이 이 코드를 봤을 때 동작을 어떻게 유추해야 할지 감이 잘 오지 않을 것 같습니다.

> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.
