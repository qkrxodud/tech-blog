---
title: "싱글톤 컨테이너와 @Configuration"
tags: ["Spring", "싱글톤", "Configuration", "CGLIB", "스프링컨테이너"]
summary: "AppConfig가 여러 번 호출되어도 싱글톤이 보장되는 이유를 @Configuration과 CGLIB 바이트코드 조작을 통해 분석합니다."
---

## AppConfig를 보자

AppConfig는 일반적으로 자바를 배운 사람이라면 객체가 계속 생성될 것으로 예상합니다. 예를 들면

- @Bean memberService -> new MemoryMemberRepository() 호출
- @Bean orderService -> new MemoryMemberRepository() 호출

하지만 위의 예측은 다릅니다. 이제부터 어떻게 다른 것인지 확인해보겠습니다.

예시 코드: AppConfig

```java
package hello.core;

import hello.core.discount.DiscountPolicy;
import hello.core.discount.RateDiscountPolicy;
import hello.core.member.MemberRepository;
import hello.core.member.MemberService;
import hello.core.member.MemberServiceImpl;
import hello.core.member.MemoryMemberRepository;
import hello.core.order.OrderService;
import hello.core.order.OrderServiceImpl;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {

//@Bean memberService -> new MemoryMemberRepository()//@Bean orderService -> new MemoryMemberRepository()@Bean
    public MemberService memberService() {
        return new MemberServiceImpl(memberRepository());
    }

    @Bean
    public OrderService orderService() {
        return new OrderServiceImpl(memberRepository(), discountPolicy());
    }

    @Bean
    public MemberRepository memberRepository() {
        return new MemoryMemberRepository();
    }

    @Bean
    public DiscountPolicy discountPolicy() {
        return new RateDiscountPolicy();
    }
}
```

## MemberServiceImpl 클래스에 테스트 용도 함수를 작성합니다

예시 코드: MemberServiceImpl

```java
package hello.core.member;

public class MemberServiceImpl implements MemberService {

    private final MemberRepository memberRepository;

    ...

		 // 테스트 용도
		public MemberRepository getMemberRepository() {
        return memberRepository;
    }

}
```

## OrderServiceImpl 클래스에 테스트용도 함수를 작성합니다

예시 코드: OrderServiceImpl

```java
package hello.core.order;

import hello.core.discount.DiscountPolicy;
import hello.core.member.*;

public class OrderServiceImpl implements OrderService{
    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    ...

// 테스트 용도
		public MemberRepository getMemberRepository() {
        return memberRepository;
    }
}
```

## ConfigurationSingletonTest 클래스를 구현합니다

예시 코드: ConfigurationSingletonTest

```java
package hello.core.singleton;

import hello.core.AppConfig;
import hello.core.member.MemberRepository;
import hello.core.member.MemberServiceImpl;
import hello.core.order.OrderServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

public class ConfigurationSingletonTest {

    @Test
    void configurationTest() {
        ApplicationContext ac = new AnnotationConfigApplicationContext(AppConfig.class);

        MemberServiceImpl memberService = ac.getBean("memberService", MemberServiceImpl.class);
        OrderServiceImpl orderService = ac.getBean("orderService", OrderServiceImpl.class);

        MemberRepository memberRepository1 = memberService.getMemberRepository();
        MemberRepository memberRepository2 = orderService.getMemberRepository();

        System.out.println("memberService -> memberRepository = " + memberRepository1);
        System.out.println("memberRepository2 -> memberRepository = " + memberRepository2);

    }
}

```

- System.out.println의 참조값이 똑같은 것을 확인할 수 있습니다.
- 어떻게 생성자를 통해서 생성한 memberRepository가 같은 참조 값을 가질 수 있을까요?
- 또한 AppConfig의 자바 코드를 보면 분명히 각각 2번 new MemoryMemberRepository를 호출해서 다른 인스턴스가 생성되어야 하는데, 어떻게 된 일일까요? 혹시 두 번 호출이 안 되는 것일까요? 실험을 통해 알아보겠습니다.

## AppConfig.java를 호출하는 것을 직접 작성해봅니다

예시 코드: AppConfig.java

```kotlin
package hello.core;

import hello.core.discount.DiscountPolicy;
import hello.core.discount.RateDiscountPolicy;
import hello.core.member.MemberRepository;
import hello.core.member.MemberService;
import hello.core.member.MemberServiceImpl;
import hello.core.member.MemoryMemberRepository;
import hello.core.order.OrderService;
import hello.core.order.OrderServiceImpl;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {

//@Bean memberService -> new MemoryMemberRepository()//@Bean orderService -> new MemoryMemberRepository()@Bean
    public MemberService memberService() {
//1번 호출
        System.out.println("call AppConfig.memberService");
        return new MemberServiceImpl(memberRepository());
    }

    @Bean
    public OrderService orderService() {
//1번 호출
        System.out.println("call AppConfig.orderService");
        return new OrderServiceImpl(memberRepository(), discountPolicy());
    }

    @Bean
    public MemberRepository memberRepository() {
//2번? 3번? 호출
        System.out.println("call AppConfig.MemberRepository");
        return new MemoryMemberRepository();
    }

    @Bean
    public DiscountPolicy discountPolicy() {
        return new RateDiscountPolicy();
    }
}

```

각각 1번씩 호출되었습니다.

java 코드로 봤을 때 분명 AppConfig.java를 통해서 MemberRepository가 호출되는 횟수는 3번이어야 합니다.

- 스프링 컨테이너가 @Bean을 등록할 때 1번
- MemberService에서 MemberRepository를 호출할 때 1번
- OrderService에서 MemberRepository를 호출할 때 1번

그런데 결과 값은 놀랍게도 `MemberRepository` 1번이 호출되었습니다.

이렇게 가능하게 만들어 주는 것이 @Configuration의 역할입니다.

스프링 컨테이너는 싱글톤 레지스트리입니다. 따라서 스프링 빈이 싱글톤이 되도록 보장해줘야 합니다.

## @Configuration을 적용한 AppConfig를 분석해봅니다

```java
@Test
    void configurationDeep() {
        ApplicationContext ac = new AnnotationConfigApplicationContext(AppConfig.class);

//AppConfig도 스프링 빈으로 등록된다.
        AppConfig bean = ac.getBean(AppConfig.class);

        System.out.println("Bean = " + bean.getClass());
//출력 결과 Bean = class hello.core.AppConfig$$EnhancerBySpringCGLIB$$4ab6406e
    }
```

해당하는 출력 값이 순수한 클래스 값이 아닌 복잡한 결과 값이 나온 것을 확인할 수 있습니다.

- 순수한 자바 클래스
    - class hello.core.AppConfig
- @Configuration의 클래스
    - class hello.core.AppConfig$$EnhancerBySpringCGLIB$$4 ab6406 e

내가 만든 클래스가 아닌 스프링이 CGLIB라는 바이트코드 조작 라이브러리를 사용해서 AppConfig 클래스를 상속받은 임의의 다른 클래스를 만들고, 그 다른 클래스를 스프링 빈으로 등록한 것입니다.

## AppConfig@CGLIB의 예상 코드(실제로는 훨씬 더 복잡합니다)

```java
@Bean
public MemberRepository memberRepository() {
     if (memoryMemberRepository가 이미 스프링 컨테이너에 등록되어 있으면?) {
        return 스프링 컨테이너에서 찾아서 반환;
     } else {//스프링 컨테이너에 없으면
        기존 로직을 호출해서 MemoryMemberRepository를 생성하고 스프링 컨테이너에 등록
         return 반환
     }
}
```

## @Configuration을 적용하지 않고, @Bean만 적용하면 어떻게 될까요

```java
//@Configuration 삭제public class AppConfig {

}
```

결과

- 싱글톤이 적용되지 않고 호출 횟수만큼 호출하는 것을 볼 수 있고
- AppConfig 또한 순수 클래스로 호출되는 것을 확인할 수 있습니다.

여기서 예전에 프록시에 관한 글이 생각이 났습니다.

우리가 @Configuration을 사용할 때 임의의 클래스로 덮어주는 것을 설명했는데, 이는 프록시 패턴을 사용할 때도 이와 같은 방법으로 설명했으니 참고하면 좋을 것 같습니다.

[https://cozing.tistory.com/54?category=1076708](https://cozing.tistory.com/54?category=1076708)

> 결과
>

우리는 이제 @Bean만 사용해도 스프링 빈으로 등록이 되지만, 싱글톤이 보장되지 않는다는 사실을 알았습니다.

크게 고민하지 말고, 스프링 설정 정보는 항상 @Configuration을 통해서 싱글톤으로 등록해야 합니다.

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
