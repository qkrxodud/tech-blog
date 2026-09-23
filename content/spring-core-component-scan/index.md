---
title: "컴포넌트 스캔"
tags: ["Spring","컴포넌트스캔","Autowired","의존관계자동주입","ComponentScan"]
summary: "설정 정보 없이 스프링 빈을 자동으로 등록하는 컴포넌트 스캔과 @Autowired 의존관계 자동 주입의 동작 방식을 정리합니다."
---

지금까지 우리는 스프링 빈을 등록할 때 @Bean이나 XML의 Bean을 사용해서 빈을 등록했습니다.

현재 예제는 몇 개 안 되지만, 이렇게 등록해야 할 스프링 빈이 수십, 수백 개가 된다면 누락 문제와 더불어 너무 번거로울 것입니다.

그래서 스프링은 설정 정보가 없어도 자동으로 스프링 빈을 등록하는 컴포넌트 스캔이라는 기능을 제공합니다.

또 의존관계 주입을 자동으로 해주는 @Autowired라는 기능도 제공합니다.

## AutoAppConfig 작성

예시 코드: AutoAppConfig

```java
package hello.core;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;

import static org.springframework.context.annotation.ComponentScan.*;

@Configuration
@ComponentScan(excludeFilters = @Filter(type = FilterType.ANNOTATION, classes = Configuration.class))
public class AutoAppConfig {

}
```

## 각각의 Service에 @Component를 추가

예시 코드: @Component 추가

```java
@Component
public class MemoryMemberRepository implements MemberRepository {}
```

```java
@Component
public class RateDiscountPolicy implements DiscountPolicy {}
```

```java
@Component
public class OrderServiceImpl implements OrderService {
	private final MemberRepository memberRepository;
 	private final DiscountPolicy discountPolicy;
    @Autowired
    public OrderServiceImpl(MemberRepository memberRepository, DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }
}
```

```java
@Component
public class MemberServiceImpl implements MemberService {
     private final MemberRepository memberRepository;
     @Autowired
     public MemberServiceImpl(MemberRepository memberRepository) {
     this.memberRepository = memberRepository;
     }
}
```

## AutoAppConfigTest 테스트 클래스를 만듭니다

예시 코드: AutoAppConfigTest.java

```java
package hello.core.scan;
import hello.core.AutoAppConfig;
import hello.core.member.Grade;
import hello.core.member.Member;
import hello.core.member.MemberService;
import hello.core.order.Order;
import hello.core.order.OrderService;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import static org.assertj.core.api.Assertions.*;
public class AutoAppConfigTest {
    @Test
    void basicScan() {
        ApplicationContext ac = new AnnotationConfigApplicationContext(AutoAppConfig.class);
        MemberService memberService = ac.getBean(MemberService.class);
        OrderService orderService = ac.getBean(OrderService.class);

        Long memberId = 1L;
        Member memberA = new Member(memberId, "memberA", Grade.VIP);
        memberService.join(memberA);

        Order order = orderService.createOrder(memberId,"itemA", 200000);
        System.out.println("Order = " + order.toString());

        assertThat(memberService).isInstanceOf(MemberService.class);
    }
}
```

## 컴포넌트 스캔과 자동 의존관계 주입이 어떻게 동작하는지 확인해봅니다

**1. @ComponentScan**

- @ComponentScan은 @Component가 붙은 모든 클래스를 스프링 빈으로 등록합니다.
- 이때 스프링 빈의 기본 이름은 클래스명을 사용하되 맨 앞글자만 소문자를 사용합니다.
    - 빈 이름 기본 전략 : MemberServiceImpl 클래스 -> memberServiceImpl
    - 빈 이름 직접 지정 : 만약 스프링 빈의 이름을 직접 지정하고 싶으면 @Component("memberService2") 이런 식으로 이름을 부여하면 됩니다.

**2. @Autowired 의존관계 자동 주입**

- 생성자에 @Autowired를 지정하면, 스프링 컨테이너가 자동으로 해당 스프링 빈을 찾아서 주입합니다.
- 이때 기본 조회 전략은 타입이 같은 빈을 찾아서 주입합니다.
    - getBean(MemberRepository.class)와 동일하다고 이해하면 됩니다.
- 생성자에 파라미터가 많아도 찾아서 자동으로 주입합니다.

## 탐색 위치와 기본 스캔 대상

탐색할 패키지의 시작 위치 지정

```
@ComponentScan(
 basePackages = "hello.core",
}
```

- basePackages : 탐색할 패키지의 시작 위치를 지정합니다. 이 패키지를 포함해서 하위 패키지를 모두 탐색합니다.
    - basePackages = {"hello.core", "hello.service"} 이렇게 여러 시작 위치를 지정할 수도 있습니다.
- basePackageClasses : 지정한 클래스의 패키지를 탐색 위치로 지정합니다.
- 만약 지정하지 않으면 @ComponentScan이 붙은 설정 정보 클래스의 패키지가 시작 위치가 됩니다.

> 권장하는 방법
>

예를 들어서 프로젝트가 다음과 같이 구조가 되어 있으면

- com.hello
- com.hello.serivce
- com.hello.repository com.hello

프로젝트 시작 루트, 여기에 AppConfig 같은 메인 설정 정보를 두고,

@ComponentScan 애노테이션을 붙이고, basePackages 지정은 생략합니다.

이렇게 하면 com.hello를 포함한 하위는 모두 자동으로 컴포넌트 스캔의 대상이 됩니다. 그리고 프로젝트 메인 설정 정보는 프로젝트를 대표하는 정보이기 때문에 프로젝트 시작 루트 위치에 두는 것이 좋다고 생각합니다.

참고로 스프링 부트를 사용하면 스프링 부트의 대표 시작 정보인 @SpringBootApplication을 이 프로젝트 시작 루트 위치에 두는 것이 관례입니다. (그리고 이 설정 안에 바로 @ComponentScan이 들어있습니다.)

## 컴포넌트 스캔 기본 대상

컴포넌트 스캔은 @Component뿐만 아니라 다음 내용도 추가로 대상에 포함합니다.

- @Component : 컴포넌트 스캔에서 사용
- @Controller : 스프링 MVC 컨트롤러에서 사용
- @Service : 스프링 비즈니스 로직에서 사용
- @Repository : 스프링 데이터 접근 계층에서 사용
- @Configuration : 스프링 설정 정보에서 사용. 해당 클래스의 소스 코드를 보면 @Component를 포함하고 있는 것을 알 수 있습니다.

> 결론
>

우리는 이제 AppConfig.java와 Config.xml 파일을 사용할 필요 없이 @Component와 @Autowired, @ComponentScan을 통해서 스프링이 자동으로 관리해주는 DI를 사용하면 됩니다. 하지만 관리하는 부분으로 봤을 때는 AppConfig.java를 사용해서 관리하는 게 좀 더 직관적으로 와닿았습니다.

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
