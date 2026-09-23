---
title: "자바 코드로 스프링 빈 직접 등록하기"
tags: ["Spring","SpringConfig","@Bean","자바 설정","의존성 주입"]
summary: "아직 데이터베이스가 정해지지 않은 상황에서 SpringConfig 자바 클래스로 스프링 빈을 직접 등록하는 방법을 정리합니다."
---

아직 데이터베이스가 정해지지 않은 상황이 발생했습니다.

이럴 때는 SpringConfig로 빈을 직접 등록해두면, DB가 선택되었을 때 SpringConfig의 MemoryMemberRepository 부분만 수정하면 됩니다.

## SpringConfig 생성

main > java > hello.hellospring 경로에 SpringConfig.java를 생성합니다.

```java
package hello.hellospring;
import hello.hellospring.repository.MemoryMemberRepository;
import hello.hellospring.service.MemberService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SpringConfig {

    @Bean
    public MemberService memberService() {
        return new MemberService(memoryMemberRepository());
    }

    @Bean
    public MemoryMemberRepository memoryMemberRepository() {// 차후에 MySqlDBMemberRepository 처럼 해당하는 인터페이스 구현체를 통해 변경해준다.return new MemoryMemberRepository();
    }
}
```

> 결론
>
> 자바에서 SpringConfig를 통해서 빈을 직접 등록해야 할 때는, 아직 정해지지 않은 DB처럼 인터페이스의 구현체를 계속 변경해야 하는 상황에 사용하면 용이합니다.

> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.
